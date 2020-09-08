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
  }

  isConnected() {
    if (!this.socket || this.socket.readyState > 1) {
      return false;
    }
    return true;
  }

  _setRetryTimer(...handlers) {
    const baseDelay = this.retryCount * this.retryBackoff > this.retryMaxWait
      ? this.retryMaxWait
      : this.retryCount * this.retryBackoff;
    const delay = baseDelay + (Math.floor(Math.random() * Math.floor(5)) - 2);
    logger.info(`Waiting ${delay}s after ${this.retryCount} tries`);
    this.retryTimer = setTimeout((...handlers) => {
      this.retryCount += 1;
      this.connect(...handlers);
    }, delay * 1000, ...handlers);
  }

  connect(connectHandler, disconnectHandler, messageHandler) {
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
          connectHandler(event);
        }
      }
      socket.onclose = (event) => {
        disconnectHandler(event);
        clearTimeout(this.retryTimer);
        if (this.isConnecting || (this.socket && !this.isHalted)) {
          this.isConnecting = false;
          this._setRetryTimer(...arguments);
        }
      }
      socket.onmessage = (event) => {
        messageHandler(event);
      }
    }
  }

  halt() {
    clearTimeout(this.retryTimer);
    this.isHalted = true;
  }

  disconnect(disconnectHandler) {
    clearTimeout(this.retryTimer);
    this.retryCount = 0;
    this.isConnecting = false;
    this.isHalted = true;
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.onmessage = null;
      this.socket.onopen = null;
      if (this.isConnected()) {
        this.socket.onclose = (event) => {
          disconnectHandler(event);
        };
        this.socket.close();
      }
      this.socket = null;
    }
  }

  send(message) {
    this.socket.send(JSON.stringify(message));
  }
}
