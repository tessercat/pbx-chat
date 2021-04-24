/*
 * Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 * CC BY-NC-ND 4.0.
 */
import logger from './logger.js';

export default class LocalMedia {

  constructor() {
    this.stream = null;
    this.isStarting = false;

    // Event handlers
    this.onStart = null;
    this.onStop = null;
    this.onStartError = null;
  }

  start(audio = true, video = false) {
    const onSuccess = (stream) => {
      if (!this.isStarting) {

        /*
         * This runs when stop is called before getUserMedia returns.
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
          this._stopStream(stream);
        });
      } else {
        this.isStarting = false;
        this.stream = stream;
      }
    }
    const onError = (error) => {
      this.isStarting = false;
      logger.error('media', error);
      if (this.onStartError) {
        this.onStartError(error);
      }
    }
    if (!this.stream && !this.isStarting) {
      this.isStarting = true;
      this._initStream(audio, video, onSuccess, onError);
    }
  }

  stop() {
    this.isStarting = false;
    this._stopStream(this.stream);
    this.stream = null;
  }

  async _initStream(audio, video, onSuccess, onError) {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      let hasAudio = false;
      let hasVideo = false;
      for (const device of devices) {
        if (device.kind.startsWith('audio')) {
          logger.debug('media', 'Found audio device');
          hasAudio = true;
        } else if (device.kind.startsWith('video')) {
          logger.debug('media', 'Found video device');
          hasVideo = true;
        }
      }
      if (audio && !hasAudio) {
        throw new Error('No audio devices.');
      }
      if (video && !hasVideo) {
        throw new Error('No video devices.');
      }
      const constraints = {audio, video};
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (this.onStart) {
        this.onStart(stream);
      }
      onSuccess(stream);
    } catch (error) {
      onError(error);
    }
  }

  _stopStream(stream) {
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
        logger.debug('media', 'Stopped', track.kind, 'track');
      }
      if (this.onStop) {
        this.onStop(stream);
      }
    }
  }
}
