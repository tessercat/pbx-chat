/*
 *  Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 *  CC BY-NC-ND 4.0.
 */
import logger from '../logger.js';

export default class VertoSocket {

  constructor() {
    this.socket = null;
    this.isOpening = false;
    this.isHalted = true;
    this.retryCount = 0;
    this.retryBackoff = 5;
    this.retryMaxWait = 30;
    this.retryTimer = null;

    // Events bindings
    this.onOpen = null;
    this.onClose = null;
    this.onMessage = null;
  }

  _setRetryTimer() {
    let delay = this.retryCount * this.retryBackoff;
    if (delay > this.retryMaxWait) {
      delay = this.retryMaxWait;
    }
    if (delay) { // Adjust delay by +/- retryBackoff
      delay += (Math.floor(
        Math.random() * (this.retryBackoff * 2 + 1)
      ) - this.retryBackoff);
    }
    logger.verto(`Waiting ${delay}s after ${this.retryCount} tries`);
    this.retryTimer = setTimeout(() => {
      this.retryCount += 1;
      this.open();
    }, delay * 1000);
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
    const socket = new WebSocket(`wss://${location.host}/verto`);
    socket.onopen = () => {
      if (this.isOpening) {
        this.isOpening = false;
        this.socket = socket;
        this.retryCount = 0;
        if (this.onOpen) {
          this.onOpen();
        } else {
          logger.verto('Socket open');
        }
      }
    }
    socket.onclose = () => {
      this.isOpening = false;
      this.socket = null;
      if (this.onClose) {
        this.onClose();
      } else {
        logger.verto('Socket closed');
      }
      if (!this.isHalted) {
        this._setRetryTimer();
      }
    }
    socket.onmessage = (event) => {
      if (this.onMessage) {
        this.onMessage(event);
      } else {
        logger.verto('Socket received message', event);
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
      logger.error('Error sending', message);
    }
  }
}
