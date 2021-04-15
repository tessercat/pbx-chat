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

  constructor() {
    this.channelId = location.pathname.split('/').pop();
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

  open() {
    this.socket.open();
  }

  close() {
    this.socket.close();
  }

  subscribe() {
    const onSuccess = () => {
      logger.verto('Subscribed');
      if (this.onSub) {
        this.onSub();
      }
    }
    const onError = (error) => {
      logger.error('Subscription error', error);
      if (this.onSubError) {
        this.onSubError(error);
      }
    }
    logger.verto('Subscribe');
    this._sendRequest('verto.subscribe', {
      eventChannel: this.channelId
    }, onSuccess, onError);
  }

  publish(eventData, onSuccess, onError) {
    logger.verto('Publish', eventData);
    const encoded = this._encode(eventData);
    if (encoded) {
      const onRequestSuccess = (message) => {
        if ('code' in message.result) {
          if (onError) {
            onError(message);
          } else {
            logger.error('Publish error', message);
          }
        } else {
          logger.verto('Published', message)
          if (onSuccess) {
            onSuccess(message);
          }
        }
      }
      this._sendRequest('verto.broadcast', {
        localBroadcast: true,
        eventChannel: this.channelId,
        eventData: encoded,
      }, onRequestSuccess, onError);
    } else {
      logger.error('Publish encoding error', eventData);
      if (onError) {
        onError(eventData);
      }
    }
  }

  sendMessage(clientId, msgData, onSuccess, onError) {
    logger.verto('Message', clientId, msgData);
    const encoded = this._encode(msgData);
    if (encoded) {
      this._sendRequest('verto.info', {
        msg: {
          to: clientId,
          body: encoded
        }
      }, onSuccess, onError);
    } else {
      logger.error('Message encoding error', msgData);
      if (onError) {
        onError(msgData);
      }
    }
  }

  // Verto socket event handlers

  _onSocketOpen() {
    let allowRetry = true;
    const onSuccess = (sessionData) => {
      if (sessionData.sessionId !== this._getSessionId()) {
        logger.error('Bad sessionId', sessionData);
        this.close();
      } else if (!CONST.uuidRegExp.test(sessionData.clientId)) {
        logger.error('Bad clientId', sessionData);
        this.close();
      } else if (!CONST.uuidRegExp.test(sessionData.password)) {
        logger.error('Bad password', sessionData);
        this.close();
      } else {
        this.sessionData = sessionData;
        this._sendRequest('login');
      }
    }
    const onError = (error) => {
      if (allowRetry && error.message === '404') {
        allowRetry = false; // allow one retry with new sessionId on 404
        this.getSessionData(this._getSessionId(true), onSuccess, onError);
      } else {
        logger.error(error);
        this.close();
      }
    }
    logger.verto('Socket open');
    this._resetClientState();
    this.getSessionData(this._getSessionId(), onSuccess, onError);
    if (this.onOpen) {
      this.onOpen();
    }
  }

  _onSocketClose() {
    logger.verto('Socket closed');
    this._resetClientState();
    if (this.onClose) {
      this.onClose();
    }
  }

  _onSocketMessage(event) {
    const message = this._parse(event.data);
    if (this.responseCallbacks[message.id]) {
      this._handleResponse(message);
    } else {
      this._handleEvent(message);
    }
  }

  // Client state helpers

  _cleanResponseCallbacks() {
    logger.verto('Cleaning callbacks');
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
      logger.error('Deleted callback', requestId);
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

  _getSessionId(expired = false) {
    let sessionId = this._getVar('sessionId');
    if (expired || !sessionId) {
      sessionId = this._getUuid();
      this._setVar('sessionId', sessionId);
    }
    return sessionId;
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
    logger.verto('Request', request);
    this.socket.send(request);
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
        logger.error('Ping error', message);
      }
    }
    const onSuccess = () => {
      logger.verto('Ping success');
      if (this.onPing) {
        this.onPing();
      }
      const delay = this._pingInterval();
      logger.verto(`Waiting ${delay} before next ping`);
      this.pingTimer = setTimeout(this._ping.bind(this), delay);
    }
    logger.verto('Ping');
    this._cleanResponseCallbacks();
    this._sendRequest('echo', {}, onSuccess, onError);
  }

  _login() {
    if (this.isAuthing) {
      return;
    }
    this.isAuthing = true;
    this.isAuthed = false;
    const onSuccess = () => {
      logger.verto('Logged in');
      this.isAuthing = false;
      this.isAuthed = true;
      const delay = this._pingInterval();
      logger.verto(`Waiting ${delay} before ping`);
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
      logger.verto('Response', message);
      const onSuccess = this.responseCallbacks[message.id].onSuccess;
      if (onSuccess) {
        onSuccess(message);
      }
    } else {
      if (message.error) {
        const code = parseInt(message.error.code);
        if (code === CONST.authRequired) {
          logger.verto('Response auth required', message);
          this._login();
        } else {
          logger.error('Response error', message);
          const onError = this.responseCallbacks[message.id].onError;
          if (onError) {
            onError(message);
          }
        }
      } else {
        logger.error('Response unhandled', message);
      }
    }
    delete this.responseCallbacks[message.id];
  }

  _handleEvent(event) {
    if (event.method === 'verto.clientReady') {
      logger.verto('Client ready', event.params);
      if (this.onReady) {
        this.onReady(event.params);
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
          logger.verto('Message', event, message);
          if (this.onMessage) {
            this.onMessage(msg.from, message);
          }
        } else {
          logger.error('Message other', event, message);
        }
      } else {
        logger.error('Message empty', event);
      }
    } else if (event.method === 'verto.event') {
      if (
          event.params
          && event.params.sessid
          && event.params.sessid === this.sessionData.sessionId) {
        logger.verto('Event own', event);
      } else if (
          event.params
          && event.params.userid
          && event.params.eventChannel
          && event.params.eventData) {
        if (event.params.eventChannel === this.channelId) {
          const clientId = event.params.userid.split('@').shift();
          const eventData = this._decode(event.params.eventData);
          logger.verto('Event', clientId, eventData);
          if (this.onEvent) {
            this.onEvent(clientId, eventData);
          }
        } else {
          logger.error('Event other', event);
        }
      } else {
        logger.error('Event unhandled', event);
      }
    } else if (event.method === 'verto.punt') {
      logger.verto('Punt');
      this.close();
      if (this.onPunt) {
        this.onPunt();
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
