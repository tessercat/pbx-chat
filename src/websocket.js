/*
 *  Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 *  CC BY-NC-ND 4.0.
 */
import logger from './logger.js';

export default class MyWebSocket {

  constructor() {
    this.socket = null;
    this.isConnecting = false;
    this.isHalted = false;
    this.retryCount = 0;
    this.retryBackoff = 5;
    this.retryMaxWait = 30;
    this.retryTimer = null;
    this.onConnect = () => {};
    this.onDisconnect = () => {};
    this.onMessage = () => {};
  }

  isConnected() {
    if (!this.socket || this.socket.readyState > 1) {
      return false;
    }
    return true;
  }

  _setRetryTimer() {
    let delay = this.retryCount * this.retryBackoff;
    if (delay > this.retryMaxWait) {
      delay = this.retryMaxWait;
    }
    if (delay) {
      delay += (
        // A random number between 0 and N-1.
        + Math.floor(Math.random() * (this.retryBackoff * 2 + 1))
        - this.retryBackoff // backoff * retries +/- backoff
      );
    }
    logger.info(`Waiting ${delay}s after ${this.retryCount} tries`);
    this.retryTimer = setTimeout(() => {
      this.retryCount += 1;
      this.connect();
    }, delay * 1000);
  }

  connect() {
    if (!this.isConnected() && !this.isConnecting) {
      this.isConnecting = true;
      this.isHalted = false;
      const socket = new WebSocket(
        `wss://${location.host}${location.pathname}/clients`
      );
      socket.onopen = (event) => {
        clearTimeout(this.retryTimer);
        if (this.isConnecting) {
          this.retryCount = 0;
          this.isConnecting = false;
          this.socket = socket;
          this.onConnect(event);
        }
      }
      socket.onclose = (event) => {
        this.onDisconnect(event);
        clearTimeout(this.retryTimer);
        this.isConnecting = false;
        if (!this.isHalted) {
          this._setRetryTimer();
        }
      }
      socket.onmessage = (event) => {
        this.onMessage(event);
      }
    }
  }

  disconnect() {
    this.isHalted = true;
    this.isConnecting = false;
    clearTimeout(this.retryTimer);
    this.retryCount = 0;
    if (this.isConnected()) {
      this.socket.close();
      this.socket = null;
    }
  }

  send(message) {
    this.socket.send(JSON.stringify(message));
  }
}
