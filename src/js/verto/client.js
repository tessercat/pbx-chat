/*
 * Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 * CC BY-NC-ND 4.0.
 */
import VertoSocket from './socket.js';
import logger from '../logger.js';

const CONST = {
  authRequired: -32000,
  uuidRegExp: new RegExp(/[-0-9a-f]{36}/, 'i'),
}

class VertoRequest {
  constructor(sessionId, requestId, method, params) {
    this.jsonrpc = '2.0';
    this.id = requestId;
    this.method = method;
    this.params = {sessid: sessionId, ...params};
  }
}

class ResponseCallbacks {
  constructor(onSuccess, onError) {
    this.sent = new Date();
    this.onSuccess = onSuccess;
    this.onError = onError;
  }
}

export default class VertoClient {

  constructor(wssUrl, channelId) {
    this.channelId = channelId;
    this.channelData = this._getChannelData();
    this.sessionData = null;

    // Client state
    this.responseCallbacks = {};
    this.isAuthing = false;
    this.isAuthed = false;
    this.pingTimer = null;
    this.pingMinDelay = 40 * 1000;
    this.pingMaxDelay = 50 * 1000;
    this.requestExpiry = 30 * 1000;

    // See _onSocketOpen
    this.getSessionData = null;

    // Client event handlers
    this.onOpen = null;
    this.onClose = null;
    this.onLogin = null;
    this.onLoginError = null;
    this.onPing = null;
    this.onPingError = null;
    this.onPunt = null;
    this.onEvent = null;

    // Socket and event bindings
    this.socket = new VertoSocket(wssUrl);
    this.socket.onOpen = this._onSocketOpen.bind(this);
    this.socket.onClose = this._onSocketClose.bind(this);
    this.socket.onMessage = this._onSocketMessage.bind(this);
  }

  // Public interface

  open() {
    this.socket.open();
  }

  close() {
    this.socket.close();
  }

  newUuid() {
    const url = URL.createObjectURL(new Blob());
    URL.revokeObjectURL(url);
    return url.split('/').pop();
  }

  sendRequest(method, params, onSuccess, onError) {
    const request = new VertoRequest(
      this.sessionData.sessionId,
      this.newUuid(),
      method,
      params
    );
    this.responseCallbacks[request.id] = new ResponseCallbacks(
      onSuccess, onError
    );
    logger.debug('client', 'Request', request);
    this.socket.send(request);
  }

  // Verto socket event handlers

  _onSocketOpen() {
    let allowRetry = true;
    const onSuccess = (sessionData) => {
      if (sessionData.sessionId !== this._getSessionId()) {
        logger.error('client', 'Bad sessionId', sessionData);
        this.close();
      } else if (!CONST.uuidRegExp.test(sessionData.clientId)) {
        logger.error('client', 'Bad clientId', sessionData);
        this.close();
      } else if (!CONST.uuidRegExp.test(sessionData.password)) {
        logger.error('client', 'Bad password', sessionData);
        this.close();
      } else {
        this.sessionData = sessionData;
        this.sendRequest('login');
      }
    }
    const onError = (error) => {
      if (allowRetry && error.message === '404') {
        allowRetry = false; // allow one retry with new sessionId on 404
        this.getSessionData(this._getSessionId(true), onSuccess, onError);
      } else {
        logger.error('client', 'Session data error', error);
        this.close();
      }
    }
    logger.debug('client', 'Socket open');
    this._resetClientState();
    this.getSessionData(this._getSessionId(), onSuccess, onError);
    if (this.onOpen) {
      this.onOpen();
    }
  }

  _onSocketClose() {
    logger.debug('client', 'Socket closed');
    this._resetClientState();
    if (this.onClose) {
      this.onClose();
    }
  }

  _onSocketMessage(event) {
    let message = null;
    try {
      message = JSON.parse(event.data);
    } catch (error) {
      logger.error('client', 'Event data parse error', event, error);
      return null;
    }
    if (this.responseCallbacks[message.id]) {
      this._handleResponse(message);
    } else {
      this._handleEvent(message);
    }
  }

  // Client state helpers

  _cleanResponseCallbacks() {
    logger.debug('client', 'Cleaning callbacks');
    const expired = [];
    const now = new Date();
    for (const requestId in this.responseCallbacks) {
      const diff = now - this.responseCallbacks[requestId].sent;
      if (diff > this.requestExpiry) {
        expired.push(requestId);
      }
    }
    for (const requestId of expired) {
      delete this.responseCallbacks[requestId];
      logger.error('client', 'Deleted callback', requestId);
    }
  }

  _resetClientState() {
    this.sessionData = null;
    this.isAuthing = false;
    this.isAuthed = false;
    clearTimeout(this.pingTimer);
    this._cleanResponseCallbacks();
  }

  _getChannelData() {
    const channelData = JSON.parse(localStorage.getItem(this.channelId));
    if (channelData) {
      return channelData;
    }
    return {};
  }

  _getVar(key) {
    return this.channelData[key] || null;
  }

  _setVar(key, value) {
    let changed = false;
    if (value && value !== this.channelData[key]) {
      changed = true;
      this.channelData[key] = value;
      logger.debug('client', 'Set', key);
    } else if (this.channelData[key] && !value) {
      changed = true;
      delete this.channelData[key];
      logger.debug('client', 'Unset', key);
    }
    if (changed) {
      localStorage.setItem(
        this.channelId, JSON.stringify(this.channelData)
      );
    }
    return changed;
  }

  _getSessionId(expired = false) {
    let sessionId = this._getVar('sessionId');
    if (expired || !sessionId) {
      sessionId = this.newUuid();
      this._setVar('sessionId', sessionId);
    }
    return sessionId;
  }

  _pingInterval() {
    return Math.floor(
      Math.random() * (
        this.pingMaxDelay - this.pingMinDelay + 1
      ) + this.pingMinDelay
    );
  }

  _ping() {
    const onError = (message) => {
      if (this.onPingError) {
        this.onPingError(message);
      } else {
        logger.error('client', 'Ping error', message);
      }
    }
    const onSuccess = () => {
      logger.debug('client', 'Ping success');
      if (this.onPing) {
        this.onPing();
      }
      const delay = this._pingInterval();
      logger.debug('client', `Waiting ${delay} before next ping`);
      this.pingTimer = setTimeout(this._ping.bind(this), delay);
    }
    logger.debug('client', 'Ping');
    this._cleanResponseCallbacks();
    this.sendRequest('echo', {}, onSuccess, onError);
  }

  _login() {
    if (this.isAuthing) {
      return;
    }
    this.isAuthing = true;
    this.isAuthed = false;
    const onSuccess = () => {
      logger.debug('client', 'Logged in');
      this.isAuthing = false;
      this.isAuthed = true;
      const delay = this._pingInterval();
      logger.debug('client', `Waiting ${delay} before ping`);
      this.pingTimer = setTimeout(this._ping.bind(this), delay);
      if (this.onLogin) {
        this.onLogin();
      }
    };
    const onError = (event) => {
      if (this.socket.isOpen()) {
        this.close();
      } else {
        this._resetClientState();
      }
      if (this.onLoginError) {
        this.onLoginError(event.error.message);
      } else {
        logger.error('client', 'Login failed', event);
      }
    };
    this.sendRequest('login', {
      login: this.sessionData.clientId,
      passwd: this.sessionData.password
    }, onSuccess, onError);
  }

  // WebSocket message handlers

  _handleResponse(message) {
    if (message.result) {
      logger.debug('client', 'Response', message);
      const onSuccess = this.responseCallbacks[message.id].onSuccess;
      if (onSuccess) {
        onSuccess(message);
      }
    } else {
      if (message.error) {
        const code = parseInt(message.error.code);
        if (code === CONST.authRequired) {
          logger.debug('client', 'Response auth required', message);
          this._login();
        } else {
          logger.error('client', 'Response error', message);
          const onError = this.responseCallbacks[message.id].onError;
          if (onError) {
            onError(message);
          }
        }
      } else {
        logger.error('client', 'Response unhandled', message);
      }
    }
    delete this.responseCallbacks[message.id];
  }

  _handleEvent(event) {
    if (event.method === 'verto.punt') {
      logger.debug('client', 'Punt');
      this.close();
      if (this.onPunt) {
        this.onPunt();
      }
    } else {
      logger.debug('client', 'Event', event);
      if (this.onEvent) {
        this.onEvent(event);
      }
    }
  }
}
