/*
 * Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 * CC BY-NC-ND 4.0.
 */
import logger from './logger.js';

export default class PeerConnection {

  constructor(peerId, isPolite) {
    this.peerId = peerId;
    this.isPolite = isPolite;
    this.localStream = null;
    this.pc = null;
    this.makingOffer = false;
    this.ignoreOffer = false;
  }

  destroy() {
    this.destroyLocalStream();
    this.destroyPeerConnection();
  }

  // Local stream methods.

  _getLocalStream(onSuccess, onError) {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      let audio = false;
      let video = false;
      for (const device of devices) {
        if (device.kind.startsWith('audio')) {
          logger.info('Found audio device');
          audio = true;
        } else if (device.kind.startsWith('video')) {
          logger.info('Found video device');
          video = true;
        }
      }
      if (!audio && !video) {
        throw new Error('No media devices found.');
      }
      return navigator.mediaDevices.getUserMedia({audio, video});
    }).then(stream => {
      onSuccess(stream);
    }).catch(error => {
      onError(error);
    });
  }

  initLocalStream(successHandler, errorHandler) {
    const onSuccess = (stream) => {
      this.localStream = stream;
      successHandler();
    }
    const onError = (error) => {
      errorHandler(error);
    }
    this._getLocalStream(onSuccess, onError);
  }

  destroyLocalStream() {
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        track.stop();
      }
      this.localStream = null;
    }
  }

  // Peer connection methods.

  _setHandlers(trackHandler, candidateHandler, offerHandler) {
    this.pc.ontrack = (event) => {
      if (event.track) {
        trackHandler(event.track);
      }
    };
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        logger.info('Sending local candidate');
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
        offerHandler(this.pc.localDescription.toJSON());
      } catch (error) {
        logger.error('SDP negotiation error', error);
      } finally {
        this.makingOffer = false;
      }
    };
  }

  initPeerConnection(...handlers) {
    const configuration = {
      iceServers: [{urls: `stun:${location.hostname}`}]
    }
    this.pc = new RTCPeerConnection(configuration);
    this._setHandlers(...handlers);
    for (const track of this.localStream.getTracks()) {
      this.pc.addTrack(track, this.localStream);
    }
  }

  destroyPeerConnection() {
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
  }

  // Incoming signal handler methods.

  async addCandidate(jsonCandidate) {
    logger.info('Received remote candidate');
    try {
      await this.pc.addIceCandidate(jsonCandidate);
    } catch (error) {
      if (!this.ignoreOffer) {
        logger.error('Error adding remote candidate', error);
      }
    }
  }

  async addDescription(jsonSdp, sendAnswerHandler) {
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
      logger.info('Sending local SDP');
      sendAnswerHandler(this.pc.localDescription.toJSON());
    }
  }
}
