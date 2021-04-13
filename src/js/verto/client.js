/*
 * Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 * CC BY-NC-ND 4.0.
 */
import VertoSocket from './socket.js';
import logger from '../logger.js';

const CONST = {
  authRequired: -32000,
  pingMinDelay: 40000,
  pingMaxDelay: 50000,
  requestExpiry: 30,
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

  constructor() {
    this.channelId = location.pathname.split('/').pop();
    this.channelData = this._getChannelData();
    this.sessionData = null;

    // Client state
    this.responseCallbacks = {};
    this.isAuthing = false;
    this.isAuthed = false;
    this.pingTimer = null;

    // Client event handlers
    this.onOpen = null;
    this.onClose = null;
    this.onLogin = null;
    this.onLoginError = null;
    this.onReady = null;
    this.onSub = null;
    this.onSubError = null;
    this.onPing = null;
    this.onPingError = null;
    this.onPunt = null;
    this.onEvent = null;
    this.onMessage = null;

    // Socket and event bindings
    this.socket = new VertoSocket();
    this.socket.onOpen = this._onSocketOpen.bind(this);
    this.socket.onClose = this._onSocketClose.bind(this);
    this.socket.onMessage = this._onSocketMessage.bind(this);
  }

  // Public interface

  getSessionId(expired = false) {
    let sessionId = this._getVar('sessionId');
    if (expired || !sessionId) {
      sessionId = this._getUuid();
      this._setVar('sessionId', sessionId);
    }
    return sessionId;
  }

  open(sessionData) {
    // TODO Validate sessionId, clientId, password.
    this.sessionData = sessionData;
    this.socket.open();
  }

  close() {
    this.socket.close();
  }

  subscribe() {
    const onSuccess = () => {
      if (this.onSub) {
        this.onSub();
      } else {
        logger.verto('Subscribed');
      }
    }
    const onError = (error) => {
      if (this.onSubError) {
        this.onSubError(error);
      } else {
        logger.error('Subscription error', error);
      }
    }
    this._sendRequest('verto.subscribe', {
      eventChannel: this.channelId
    }, onSuccess, onError);
  }

  publish(eventData, onSuccess, onError) {
    logger.verto('Publishing event', eventData);
    const encoded = this._encode(eventData);
    if (encoded) {
      const onRequestSuccess = (message) => {
        if ('code' in message.result) {
          if (onError) {
            onError(message);
          } else {
            logger.error('Publish event error', message);
          }
        } else {
          if (onSuccess) {
            onSuccess(message);
          } else {
            logger.verto('Published event', message)
          }
        }
      }
      this._sendRequest('verto.broadcast', {
        localBroadcast: true,
        eventChannel: this.channelId,
        eventData: encoded,
      }, onRequestSuccess, onError);
    } else {
      if (onError) {
        onError('Encoding error');
      } else {
        logger.error('Encoding error', eventData);
      }
    }
  }

  sendMessage(clientId, msgData, onSuccess, onError) {
    logger.verto('Sending message', clientId, msgData);
    const encoded = this._encode(msgData);
    if (encoded) {
      this._sendRequest('verto.info', {
        msg: {
          to: clientId,
          body: encoded
        }
      }, onSuccess, onError);
    } else {
      if (onError) {
        onError(msgData);
      }
    }
  }

  // Verto socket event handlers

  _onSocketOpen() {
    this._resetClientState();
    if (this.onOpen) {
      this.onOpen();
    } else {
      logger.verto('Socket open');
    }
    this._sendRequest('login');
  }

  _onSocketClose() {
    this._resetClientState();
    this.sessionData = null;
    if (this.onClose) {
      this.onClose();
    } else {
      logger.verto('Socket closed');
    }
  }

  _onSocketMessage(event) {
    const message = this._parse(event.data);
    if (this.responseCallbacks[message.id]) {
      logger.debug('Received response', message);
      this._handleResponse(message);
    } else {
      logger.debug('Received event', message);
      this._handleEvent(message);
    }
  }

  // Client state helpers

  _cleanResponseCallbacks() {
    const expired = [];
    const now = new Date();
    logger.verto('Cleaning callbacks');
    for (const requestId in this.responseCallbacks) {
      const diff = now - this.responseCallbacks[requestId].sent;
      if (diff > CONST.requestExpiry * 1000) {
        expired.push(requestId);
      }
    }
    for (const requestId of expired) {
      delete this.responseCallbacks[requestId];
      logger.error('Deleted callback', requestId);
    }
  }

  _resetClientState() {
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

  _getUuid() {
    const url = URL.createObjectURL(new Blob());
    URL.revokeObjectURL(url);
    return url.split('/').pop();
  }

  _getVar(key) {
    return this.channelData[key] || null;
  }

  _setVar(key, value) {
    let changed = false;
    if (value && value !== this.channelData[key]) {
      changed = true;
      this.channelData[key] = value;
      logger.verto('Set', key);
    } else if (this.channelData[key] && !value) {
      changed = true;
      delete this.channelData[key];
      logger.verto('Unset', key);
    }
    if (changed) {
      localStorage.setItem(
        this.channelId, JSON.stringify(this.channelData)
      );
    }
    return changed;
  }

  _sendRequest(method, params, onSuccess, onError) {
    const request = new VertoRequest(
      this.sessionData.sessionId,
      this._getUuid(),
      method,
      params
    );
    this.responseCallbacks[request.id] = new ResponseCallbacks(
      onSuccess, onError
    );
    logger.debug('Sending request', request);
    this.socket.send(request);
  }

  _ping() {
    this._cleanResponseCallbacks();
    const onError = (message) => {
      if (this.onPingError) {
        this.onPingError(message);
      } else {
        logger.error('Ping failure', message);
      }
    }
    const onSuccess = () => {
      if (this.onPing) {
        this.onPing();
      } else {
        logger.verto('Ping success');
      }
      this.pingTimer = setTimeout(
        this._ping.bind(this), this._pingInterval()
      );
    }
    this._sendRequest('echo', {}, onSuccess, onError);
  }

  _pingInterval() {
    return Math.floor(
      Math.random() * (
        CONST.pingMaxDelay - CONST.pingMinDelay + 1
      ) + CONST.pingMinDelay);
  }

  _login() {
    if (this.isAuthing) {
      return;
    }
    this.isAuthing = true;
    this.isAuthed = false;
    const onSuccess = () => {
      this.isAuthing = false;
      this.isAuthed = true;
      this.pingTimer = setTimeout(
        this._ping.bind(this), this._pingInterval()
      );
      if (this.onLogin) {
        this.onLogin();
      } else {
        logger.verto('Logged in');
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
        logger.error('Login failed', event);
      }
    };
    this._sendRequest('login', {
      login: this.sessionData.clientId,
      passwd: this.sessionData.password
    }, onSuccess, onError);
  }

  // WebSocket message handlers

  _handleResponse(message) {
    if (message.result) {
      const onSuccess = this.responseCallbacks[message.id].onSuccess;
      if (onSuccess) {
        onSuccess(message);
      } else {
        logger.verto('Response', message);
      }
    } else {
      if (message.error) {
        const code = parseInt(message.error.code);
        if (code === CONST.authRequired) {
          this._login();
        } else {
          const onError = this.responseCallbacks[message.id].onError;
          if (onError) {
            onError(message);
          } else {
            logger.error('Error response', message);
          }
        }
      } else {
        logger.error('Bad response', message);
      }
    }
    delete this.responseCallbacks[message.id];
  }

  _handleEvent(event) {
    if (event.method === 'verto.clientReady') {
      if (this.onReady) {
        this.onReady(event.params);
      } else {
        logger.verto('Client ready', event.params);
      }
    } else if (event.method === 'verto.info') {
      if (
          event.params
          && event.params.msg
          && event.params.msg.to
          && event.params.msg.from
          && event.params.msg.body) {
        const msg = event.params.msg;
        const clientId = msg.to.split('@').shift();
        const message = this._decode(msg.body);
        if (clientId && clientId === this.sessionData.clientId) {
          if (this.onMessage) {
            this.onMessage(msg.from, message);
          } else {
            logger.verto('Message', event, message);
          }
        } else {
          logger.error('Other message', event, message);
        }
      } else {
        logger.error('Empty message', event);
      }
    } else if (event.method === 'verto.event') {
      if (
          event.params
          && event.params.sessid
          && event.params.sessid === this.sessionData.sessionId) {
        logger.verto('Own event', event);
      } else if (
          event.params
          && event.params.userid
          && event.params.eventChannel
          && event.params.eventData) {
        if (event.params.eventChannel === this.channelId) {
          const clientId = event.params.userid.split('@').shift();
          const eventData = this._decode(event.params.eventData);
          if (this.onEvent) {
            this.onEvent(clientId, eventData);
          } else {
            logger.verto('Event', clientId, eventData);
          }
        } else {
          logger.error('Other event', event);
        }
      } else {
        logger.error('Bad event', event);
      }
    } else if (event.method === 'verto.punt') {
      this.close();
      if (this.onPunt) {
        this.onPunt();
      } else {
        logger.verto('Punt');
      }
    } else {
      logger.error('Unhandled', event);
    }
  }

  // Event and message data processing helpers.

  /*
   * These methods eat exceptions.
   *
   * Parsing takes a stringified object as input and returns the object,
   * or null on error.
   *
   * Encoding takes an object as input and returns a Base64-encoded JSON
   * string, or an empty string on error.
   *
   * Decoding takes a Base64-encoded stringified object as input, decodes
   * it and returns the object, or null on error.
   */

  _parse(string) {
    try {
      return JSON.parse(string);
    } catch (error) {
      logger.error('Error parsing', string, error);
      return null;
    }
  }

  _encode(object) {
    try {
      const string = JSON.stringify(object);
      return btoa(encodeURIComponent(string).replace(
        /%([0-9A-F]{2})/g, (match, p1) => {
          return String.fromCharCode('0x' + p1);
        }
      ));
    } catch (error) {
      logger.error('Error encoding', object, error);
      return '';
    }
  }

  _decode(encoded) {
    try {
      const string = decodeURIComponent(
        atob(encoded).split('').map((c) => {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join('')
      );
      return JSON.parse(string);
    } catch (error) {
      logger.error('Error decoding', encoded, error);
      return null;
    }
  }
}
