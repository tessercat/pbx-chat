/*
 * Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 * CC BY-NC-ND 4.0.
 */
import logger from './logger.js';

export default class Connection {

  constructor() {
    this.clientId = null;
    this.isPolite = null;
    this.userMedia = null;
    this.pc = null;
    this.makingOffer = false;
    this.ignoreOffer = false;
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

  setConnected(clientId, isPolite, stunServer) {
    this.clientId = clientId;
    this.isPolite = isPolite;
    const configuration = {
      iceServers: [{urls: `stun:${stunServer}`}],
    }
    this.pc = new RTCPeerConnection(configuration);
    this.pc.ontrack = (event) => {
      if (event.track) {
        logger.info('Added remote', event.track.kind, 'track');
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
        this.makingOffer = true;
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
        this.makingOffer = false;
      }
    };
  }

  open() {
    logger.info('Connecting');
    for (const track of this.userMedia.getTracks()) {
      this.pc.addTrack(track, this.userMedia);
    }
  }

  close() {
    this.clientId = null;
    if (this.pc) {
      this.pc.close();
      this.pc = null;
      logger.info('Connection closed');
    }
    if (this.userMedia) {
      for (const track of this.userMedia.getTracks()) {
        track.stop();
        logger.info('Stopped local', track.kind, 'track');
      }
      this.userMedia = null;
    }
  }

  // User media methods.

  initUserMedia(successHandler, errorHandler, audio, video) {
    const onSuccess = (stream) => {
      this.userMedia = stream;
      if (this.clientId) {
        successHandler();
      } else {

        /*
         * This runs when the connection closes while getUserMedia is
         * generating a local media stream.
         *
         * In September of 2020, there must be some kind of race condition
         * in Android Chromium (Android 10 Chrome, Android 6 Vivaldi)
         * when media stream tracks are stopped too soon after starting.
         *
         * Tracks are live before they're stopped, and ended after,
         * but stopping them so soon after starting must leave a reference
         * behind somewhere, because the browser shows media devices
         * as active, even after stream tracks close.
         *
         * A slight pause before stopping tracks seems to take care
         * of the problem.
         *
         * I haven't seen this in Firefox, Chromium or Vivaldi on Linux,
         * so I assume it's Android only.
         */

        const sleep = () => new Promise((resolve) => setTimeout(resolve, 500));
        sleep().then(() => {
          this.close();
        });
      }
    }
    const onError = (error) => {
      errorHandler(error);
    }
    this._getUserMedia(onSuccess, onError, audio, video);
  }

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
        throw new Error('No audio devices.');
      }
      if (video && !hasVideo) {
        throw new Error('No video devices.');
      }
      return navigator.mediaDevices.getUserMedia({audio, video});
    }).then(stream => {
      onSuccess(stream);
    }).catch(error => {
      onError(error);
    });
  }

  // Inbound signal handlers.

  async addCandidate(jsonCandidate) {
    if (this.pc.connectionState === 'failed') {
      this.onIceError();
    } else {
      try {
        await this.pc.addIceCandidate(jsonCandidate);
      } catch (error) {
        if (!this.ignoreOffer) {
          logger.error('Error adding remote candidate', error);
        }
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
