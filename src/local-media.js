/*
 * Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 * CC BY-NC-ND 4.0.
 */
import logger from './logger.js';

export default class LocalMedia {

  constructor() {
    this.isPolite = null;
    this.mediaStream = null;
    this.isStarting = false;
  }

  stop() {
    this.isStarting = false;
    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        track.stop();
        logger.info('Stopped local', track.kind, 'track');
      }
      this.mediaStream = null;
    }
  }

  start(onSuccess, onError) {
    this.isStarting = true;
    const onMediaSuccess = (stream) => {
      this.mediaStream = stream;
      if (this.isStarting) {
        this.isStarting = false;
        onSuccess();
      } else {

        /*
         * This runs when media stops before getUserMedia returns.
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
          this.stop();
        });
      }
    }
    const onMediaError = (error) => {
      this.isStarting = false;
      onError(error);
    }
    this._getUserMedia(onMediaSuccess, onMediaError, true, true);
  }

  _getUserMedia(onSuccess, onError, audio, video) {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      let hasAudio = false;
      let hasVideo = false;
      for (const device of devices) {
        if (device.kind.startsWith('audio')) {
          logger.info('Found local audio device');
          hasAudio = true;
        } else if (device.kind.startsWith('video')) {
          logger.info('Found local video device');
          hasVideo = true;
        }
      }
      if (audio && !hasAudio) {
        throw new Error('No local audio devices.');
      }
      if (video && !hasVideo) {
        throw new Error('No local video devices.');
      }
      return navigator.mediaDevices.getUserMedia({audio, video});
    }).then(stream => {
      onSuccess(stream);
    }).catch(error => {
      onError(error);
    });
  }
}
