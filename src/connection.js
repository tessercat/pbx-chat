/*
 * Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 * CC BY-NC-ND 4.0.
 */
import logger from './logger.js';

export default class Connection {

  constructor(isPolite) {
    this.isPolite = isPolite;
    this.userMedia = null;
    this.pc = null;
    this.makingOffer = false;
    this.ignoreOffer = false;
  }

  init(trackHandler, candidateHandler, failureHandler, sdpHandler) {
    const configuration = {
      iceServers: [{urls: `stun:${location.hostname}`}],
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
      } else {
        if (this.pc.connectionState === 'failed') {
          failureHandler();
        }
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
        if (this.pc.localDescription) {
          sdpHandler(this.pc.localDescription.toJSON());
        }
      } catch (error) {
        logger.error('SDP negotiation error', error);
      } finally {
        this.makingOffer = false;
      }
    };
  }

  close() {
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    if (this.userMedia) {
      for (const track of this.userMedia.getTracks()) {
        track.stop();
      }
      this.userMedia = null;
    }
  }

  // User media methods.

  _getUserMedia(onSuccess, onError, audio, video) {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      let hasAudio = false;
      let hasVideo = false;
      for (const device of devices) {
        if (device.kind.startsWith('audio')) {
          logger.info('Found audio device');
          hasAudio = true;
        } else if (device.kind.startsWith('video')) {
          logger.info('Found video device');
          hasVideo = true;
        }
      }
      if (audio && !hasAudio) {
        throw new Error('No audio devices found.');
      }
      if (video && !hasVideo) {
        throw new Error('No video devices found.');
      }
      return navigator.mediaDevices.getUserMedia({audio, video});
    }).then(stream => {
      onSuccess(stream);
    }).catch(error => {
      onError(error);
    });
  }

  initUserMedia(successHandler, errorHandler, audio, video) {
    const onSuccess = (stream) => {
      this.userMedia = stream;
      successHandler(stream);
    }
    const onError = (error) => {
      errorHandler(error);
    }
    this._getUserMedia(onSuccess, onError, audio, video);
  }

  addTracks() {
    if (!this.userMedia || this.userMedia.getTracks().length === 0) {
      throw new Error('No user media found.');
    }
    for (const track of this.userMedia.getTracks()) {
      this.pc.addTrack(track, this.userMedia);
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
