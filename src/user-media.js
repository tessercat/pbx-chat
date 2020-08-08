/*
 * Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 * CC BY-NC-ND 4.0.
 */
import logger from './logger.js';

export default class UserMedia {

  constructor() {
    this.stream = null;
  }

  _getUserMedia(onSuccess, onError) {
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

  init(successHandler, errorHandler) {
    const onSuccess = (stream) => {
      this.stream = stream;
      successHandler(stream);
    }
    const onError = (error) => {
      errorHandler(error);
    }
    if (this.stream) {
      successHandler(this.stream);
    } else {
      this._getUserMedia(onSuccess, onError);
    }
  }

  destroy() {
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }
  }
}
