/*
 * Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 * CC BY-NC-ND 4.0.
 */
import logger from './logger.js';

export default class Connection {

  constructor(isPolite, stunServer) {
    this.isPolite = isPolite;
    this.pc = null;
    this._init(stunServer);
    this.isOfferingSdp = false;
    this.isIgnoringOffers = false;

    this.onTrack = () => {};
    this.onSdp = () => {};
    this.onCandidate = () => {};
    this.onConnected = () => {};
    this.onFailed = () => {};
  }

  _init(stunServer) {
    const configuration = {
      iceServers: [{urls: `stun:${stunServer}`}],
    }
    this.pc = new RTCPeerConnection(configuration);
    this.pc.ontrack = (event) => {
      if (event.track) {
        logger.info('Receiving remote', event.track.kind);
        this.onTrack(event.track);
      }
    };
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.onCandidate(event.candidate.toJSON());
      }
    };
    this.pc.onconnectionstatechange = () => {
      if (this.pc.connectionState === 'connected') {
        logger.info('Connected');
        this.onConnected();
      } else if (this.pc.connectionState === 'failed') {
        logger.info('Failed');
        this.onFailed();
      }
    }
    this.pc.onnegotiationneeded = async () => {
      try {
        this.isOfferingSdp = true;
        const offer = await this.pc.createOffer();
        if (this.pc.signalingState !== 'stable') {
          logger.info('Abandoning SDP negotiation');
          return;
        }
        await this.pc.setLocalDescription(offer);
        if (this.pc.localDescription) {
          this.onSdp(this.pc.localDescription.toJSON());
        }
      } catch (error) {
        logger.error('SDP negotiation error', error);
      } finally {
        this.isOfferingSdp = false;
      }
    };
  }

  close() {
    if (this.isOpen()) {
      this.pc.close();
      this.pc = null;
      logger.info('Connection closed');
    }
  }

  addTracks(stream) {
    for (const track of stream.getTracks()) {
      logger.info('Sending local', track.kind);
      this.pc.addTrack(track, stream);
    }
  }

  // Inbound signal handlers.

  async addCandidate(candidate) {
    try {
      await this.pc.addIceCandidate(candidate);
    } catch (error) {
      if (!this.isIgnoringOffers) {
        logger.error('Error adding remote candidate', error);
      }
    }
  }

  async addSdp(sdpDict, sendAnswer) {
    const sdp = new RTCSessionDescription(sdpDict);
    const isOfferCollision = (
      sdp.type === 'offer'
      && (this.isOfferingSdp || this.pc.signalingState !== 'stable')
    );
    this.isIgnoringOffers = !this.isPolite && isOfferCollision;
    if (this.isIgnoringOffers) {
      logger.info('Ignoring SDP offer');
      return;
    }
    if (isOfferCollision) {
      await Promise.all([
        this.pc.setLocalDescription({type: "rollback"}).catch((error) => {
          logger.error('SDP rollback error', error);
        }),
        this.pc.setRemoteDescription(sdp)
      ]);
      logger.info('Rolled back local SDP and accepted remote');
    } else {
      await this.pc.setRemoteDescription(sdp);
      logger.info('Accepted remote SDP');
    }
    if (sdp.type === 'offer') {
      await this.pc.setLocalDescription(await this.pc.createAnswer());
      sendAnswer(this.pc.localDescription.toJSON());
    }
  }
}
