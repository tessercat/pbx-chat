/*
 * Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 * CC BY-NC-ND 4.0.
 */
import logger from './logger.js';

export default class Connection {

  constructor() {
    this.clientId = null;
    this.isPolite = null;
    this.pc = null;
    this.isOffering = false;
    this.isIgnoringOffers = false;
    this.onTrack = () => {};
    this.onSdp = () => {};
    this.onCandidate = () => {};
    this.onIceError = () => {};
  }

  isConnectedTo(clientId) {
    if (clientId && this.clientId) {
      return clientId === this.clientId;
    }
    return false;
  }

  isIdle() {
    return this.clientId === null;
  }

  open(clientId, isPolite, stunServer) {
    this.clientId = clientId;
    this.isPolite = isPolite;
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
      } else {
        if (this.pc.connectionState === 'failed') {
          this.onIceError();
        }
      }
    };
    this.pc.onnegotiationneeded = async () => {
      try {
        this.isOffering = true;
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
        this.isOffering = false;
      }
    };
  }

  addTracks(stream) {
    for (const track of stream.getTracks()) {
      logger.info('Sending local', track.kind);
      this.pc.addTrack(track, stream);
    }
  }

  close() {
    this.clientId = null;
    if (this.pc) {
      this.pc.close();
      this.pc = null;
      logger.info('Connection closed');
    }
  }

  // Inbound signal handlers.

  async addCandidate(jsonCandidate) {
    if (this.pc.connectionState === 'failed') {
      this.onIceError();
    } else {
      try {
        await this.pc.addIceCandidate(jsonCandidate);
      } catch (error) {
        if (!this.isIgnoringOffers) {
          logger.error('Error adding remote candidate', error);
        }
      }
    }
  }

  async addSdp(jsonSdp, sdpHandler) {
    const sdp = new RTCSessionDescription(jsonSdp);
    const offerCollision = (
      sdp.type === 'offer'
      && (this.isOffering || this.pc.signalingState !== 'stable')
    );
    this.isIgnoringOffers = !this.isPolite && offerCollision;
    if (this.isIgnoringOffers) {
      logger.info('Ignoring SDP offer');
      return;
    }
    if (offerCollision) {
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
      sdpHandler(this.pc.localDescription.toJSON());
    }
  }
}
