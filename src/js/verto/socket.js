/*
 *  Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 *  CC BY-NC-ND 4.0.
 */
import logger from '../logger.js';

export default class VertoSocket {

  constructor(wssUrl) {
    this.wssUrl = wssUrl;
    this.socket = null;
    this.isOpening = false;
    this.isHalted = true;
    this.retryCount = 0;
    this.retryBackoff = 5 * 1000;
    this.retryMaxWait = 30 * 1000;
    this.retryRange = 5 * 1000;
    this.retryTimer = null;

    // Events bindings
    this.onOpen = null;
    this.onClose = null;
    this.onMessage = null;
  }

  _retryInterval() {
    let delay = this.retryCount * this.retryBackoff;
    if (delay > this.retryMaxWait) {
      delay = this.retryMaxWait;
    }
    if (delay) {
      const minDelay = delay - this.retryRange;
      const maxDelay = delay + this.retryRange;
      delay = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay);
    }
    return delay;
  }

  isOpen() {
    return this.socket && this.socket.readyState <= 1;
  }

  open() {
    if (this.isOpen() || this.isOpening) {
      return;
    }
    this.isOpening = true;
    this.isHalted = false;
    clearTimeout(this.retryTimer);
    const socket = new WebSocket(this.wssUrl);
    socket.onopen = () => {
      if (this.isOpening) {
        this.isOpening = false;
        this.socket = socket;
        this.retryCount = 0;
        if (this.onOpen) {
          this.onOpen();
        }
      }
    }
    socket.onclose = () => {
      this.isOpening = false;
      this.socket = null;
      if (this.onClose) {
        this.onClose();
      }
      if (!this.isHalted) {
        const delay = this._retryInterval();
        logger.debug('socket', `Waiting ${delay} after ${this.retryCount} tries`);
        this.retryTimer = setTimeout(() => {
          this.retryCount += 1;
          this.open();
        }, delay);
      }
    }
    socket.onmessage = (message) => {
      if (this.onMessage) {
        this.onMessage(message);
      }
    }
  }

  close() {
    this.isHalted = true;
    this.isOpening = false;
    clearTimeout(this.retryTimer);
    this.retryCount = 0;
    if (this.isOpen()) {
      this.socket.close();
    }
  }

  send(message) {
    if (this.socket && this.socket.readyState === 1) {
      this.socket.send(JSON.stringify(message));
    } else {
      logger.error('socket', 'Error sending', message);
    }
  }
}
