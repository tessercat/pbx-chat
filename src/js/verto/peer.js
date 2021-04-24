/*
 * Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 * CC BY-NC-ND 4.0.
 */
import logger from '../logger.js';

export default class VertoPeer {

  constructor(stunUrl, isPolite) {
    this.stunUrl = stunUrl;
    this.isPolite = isPolite;
    this.pc = null;
    this.isOffering = false;
    this.isIgnoringOffers = false;

    // Event handlers
    this.onConnected = null;
    this.onClosed = null;
    this.onFailed = null;
    this.onIceData = null;
    this.onSdpOffer = null;
    this.onBundleReady = null;
    this.onRemoteTrack = null;
  }

  init() {
    if (!this.pc) {
      this.pc = this._newConnection();
      this.isOffering = false;
      this.isIgnoringOffers = false;
    }
  }

  close() {
    if (this.pc && this.pc.connectionState !== 'closed') {
      this.pc.close();
      this.pc = null;
    }
  }

  addTracks(stream) {
    for (const track of stream.getTracks()) {
      logger.debug('peer', 'Sending', track.kind);
      this.pc.addTrack(track, stream);
    }
  }

  _newConnection() {
    const config = {
      iceServers: [{urls: this.stunUrl}],
      bundlePolicy: 'max-compat',
      sdpSemantics: 'plan-b',
    }
    const pc = new RTCPeerConnection(config);
    pc.ontrack = (event) => {
      if (event.track) {
        logger.debug('peer', 'Receiving media', event.track);
        if (this.onRemoteTrack) {
          this.onRemoteTrack(event.track);
        }
      }
    };
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const candidate = event.candidate.toJSON();
        logger.debug('peer', 'Offering candidate', candidate)
        if (this.onIceData) {
          this.onIceData(candidate);
        }
      }
    };
    pc.onicegatheringstatechange = async () => {
      if (pc.iceGatheringState === 'complete' && pc.localDescription) {
        const sdp = pc.localDescription.toJSON();
        logger.debug('peer', 'Bundle ready', sdp)
        if (this.onBundleReady) {
          this.onBundleReady(sdp.sdp);
        }
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        logger.debug('peer', 'Connected');
        if (this.onConnected) {
          this.onConnected();
        }
      } else if (pc.connectionState === 'closed') {
        logger.debug('peer', 'Closed');
        if (this.onClosed) {
          this.onClosed();
        }
      } else if (pc.connectionState === 'failed') {
        logger.debug('peer', 'Failed');
        if (this.onFailed) {
          this.onFailed();
        }
      }
    }
    pc.onnegotiationneeded = async () => {
      try {
        this.isOffering = true;
        const offer = await pc.createOffer();
        if (pc.signalingState !== 'stable') {
          logger.debug('peer', 'Abandoned offer');
          return;
        }
        await pc.setLocalDescription(offer);
        if (pc.localDescription) {
          const sdp = pc.localDescription.toJSON();
          logger.debug('peer', 'Offering', sdp)
          if (this.onSdpOffer) {
            this.onSdpOffer(sdp);
          }
        }
      } catch (error) {
        logger.error('rtp', 'Negotiation error', error);
      } finally {
        this.isOffering = false;
      }
    };
    return pc;
  }

  // Inbound signal handlers.

  async addIceCandidate(candidate) {
    try {
      await this.pc.addIceCandidate(candidate);
    } catch (error) {
      if (!this.isIgnoringOffers) {
        logger.error('Received bad ICE data', candidate);
      }
    }
  }

  async setRemoteDescription(type, sdpString, onAnswer) {
    const sdp = new RTCSessionDescription({type: type, sdp: sdpString});
    const isOfferCollision = (
      sdp.type === 'offer'
      && (this.isOffering || this.pc.signalingState !== 'stable')
    );
    this.isIgnoringOffers = !this.isPolite && isOfferCollision;
    if (this.isIgnoringOffers) {
      logger.debug('peer', 'Ignored offer', sdp);
      return;
    }
    if (isOfferCollision) {
      await Promise.all([
        this.pc.setLocalDescription({type: "rollback"}).catch((error) => {
          logger.error('rtp', 'Rollback error', error);
        }),
        this.pc.setRemoteDescription(sdp)
      ]);
      logger.debug('rtp', 'Rolled back offer');
    } else {
      await this.pc.setRemoteDescription(sdp);
      logger.debug('peer', 'Accepted offer', sdp);
    }
    if (sdp.type === 'offer') {
      await this.pc.setLocalDescription(await this.pc.createAnswer());
      const sdp = this.pc.localDescription.toJSON();
      logger.debug('peer', 'Sending answer', sdp);
      if (onAnswer) {
        onAnswer(sdp);
      }
    }
  }
}
