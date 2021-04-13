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
    this.isStopped = false;
  }

  stop(onStopped) {
    this.isStopped = true;
    if (this.mediaStream) {
      this._stopTracks();
      onStopped();
    } else if (!this.isStarting) {
      onStopped();
    }
  }

  start(onStarted, onStopped, onError) {
    const onMediaSuccess = (stream) => {
      this.isStarting = false;
      this.mediaStream = stream;
      if (this.isStopped) {

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
          this._stopTracks();
          onStopped();
        });
      } else {
        onStarted();
      }
    }
    const onMediaError = (error) => {
      this.isStarting = false;
      onError(error);
    }
    this.isStarting = true;
    this.isStopped = false;
    this._start(onMediaSuccess, onMediaError, true, true);
  }

  _stopTracks() {
    for (const track of this.mediaStream.getTracks()) {
      track.stop();
      logger.info('Stopped local', track.kind, 'track');
    }
    this.mediaStream = null;
  }

  async _start(onSuccess, onError, audio, video) {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
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
      onSuccess(await navigator.mediaDevices.getUserMedia({audio, video}));
    } catch (error) {
      onError(error.message);
    }
  }
}
