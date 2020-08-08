/*
 * Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 * CC BY-NC-ND 4.0.
 */
import logger from './logger.js';

export default class PeerConnection {

  constructor(peerId, isPolite) {
    this.peerId = peerId;
    this.isPolite = isPolite;
    this.pc = null;
    this.makingOffer = false;
    this.ignoreOffer = false;
  }

  init(trackHandler, candidateHandler, sdpHandler) {
    const configuration = {
      iceServers: [{urls: `stun:${location.hostname}`}]
    }
    this.pc = new RTCPeerConnection(configuration);
    this.pc.ontrack = (event) => {
      if (event.track) {
        trackHandler(event.track);
      }
    };
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        candidateHandler(event.candidate.toJSON());
      }
    };
    this.pc.onnegotiationneeded = async () => {
      try {
        this.makingOffer = true;
        const offer = await this.pc.createOffer();
        if (this.pc.signalingState !== 'stable') {
          logger.info('Abandoning SDP negotiation');
          return;
        }
        await this.pc.setLocalDescription(offer);
        sdpHandler(this.pc.localDescription.toJSON());
      } catch (error) {
        logger.error('SDP negotiation error', error);
      } finally {
        this.makingOffer = false;
      }
    };
  }

  addUserMedia(stream) {
    for (const track of stream.getTracks()) {
      this.pc.addTrack(track, stream);
    }
  }

  close() {
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
  }

  // Incoming signal handler methods.

  async addCandidate(jsonCandidate) {
    try {
      await this.pc.addIceCandidate(jsonCandidate);
    } catch (error) {
      if (!this.ignoreOffer) {
        logger.error('Error adding remote candidate', error);
      }
    }
  }

  async addSdp(jsonSdp, sdpHandler) {
    const sdp = new RTCSessionDescription(jsonSdp);
    const offerCollision = (
      sdp.type === 'offer'
      && (this.makingOffer || this.pc.signalingState !== 'stable')
    );
    this.ignoreOffer = !this.isPolite && offerCollision;
    if (this.ignoreOffer) {
      logger.info('Ignoring SDP offer');
      return;
    }
    if (offerCollision) {
      await Promise.all([
        this.pc.setLocalDescription({type: 'rollback'}),
        this.pc.setRemoteDescription(sdp)
      ]);
      logger.info('Rolled back local SDP and accepted remote SDP');
    } else {
      await this.pc.setRemoteDescription(sdp);
      logger.info('Accepted remote SDP');
    }
    if (sdp.type === 'offer') {
      await this.pc.setLocalDescription(await this.pc.createAnswer());
      sdpHandler(this.pc.localDescription.toJSON());
    }
  }
}
