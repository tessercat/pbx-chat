/*
 * Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 * CC BY-NC-ND 4.0.
 */
import MyWebSocket from './websocket.js';
import logger from './logger.js';

const CONST = {
  authRequired: -32000,
  pingInterval: 45,
  pingMaxVary: 5,
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

export default class Client {

  constructor() {
    this.channelId = location.pathname.split('/').pop();

    // WebSocket
    this.ws = new MyWebSocket();
    this.ws.onConnect = this._onWsConnect.bind(this);
    this.ws.onDisconnect = this._onWsDisconnect.bind(this);
    this.ws.onMessage = this._onWsMessage.bind(this);

    // Ping/activity
    this.pingTimer = null;
    this.lastActive = null;
    this._addActivityListeners();

    // Channel/session
    this.channelData = this._initChannelData();
    this.authing = false;
    this.responseCallbacks = {};
    this.isSubscribed = false;

    // Events
    this.onConnect = () => {};
    this.onDisconnect = () => {};
    this.onLogin = () => {};
    this.onLoginError = () => {};
    this.onReady = () => {};
    this.onPing = () => {};
    this.onPingError = () => {};
    this.onPunt = () => {};
    this.onEvent = () => {};
    this.onMessage = () => {};
  }

  // Channel vars

  getChannelVar(key) {
    return this.channelData[key] || null;
  }

  setChannelVar(key, value) {
    let changed = false;
    if (value && value !== this.channelData[key]) {
      changed = true;
      this.channelData[key] = value;
      logger.info('Set', key);
    } else if (this.channelData[key] && !value) {
      changed = true;
      delete this.channelData[key];
      logger.info('Unset', key);
    }
    if (changed) {
      localStorage.setItem(
        this.channelId, JSON.stringify(this.channelData)
      );
    }
    return changed;
  }

  // Channel state

  isConnected() {
    return this.ws.isConnected();
  }

  isTrying() {
    return !this.ws.isHalted;
  }

  connect() {
    if (!this.isConnected()) {
      const onSuccess = (sessionId, loginData) => {
        this.sessionId = sessionId;
        this.clientId = loginData.clientId;
        this.password = loginData.password;
        this.ws.connect();
      };
      const onError = (error) => {
        this.onLoginError(error.message);
      }
      this._startSession(onSuccess, onError);
    }
  }

  disconnect() {
    this.ws.disconnect();
  }

  // Send interface

  subscribe(onSuccess, onError) {
    const onRequestSuccess = () => {
      this.isSubscribed = true;
      logger.info('Subscribed');
      if (onSuccess) {
        onSuccess();
      }
    }
    const onRequestError = (error) => {
      this.isSubscribed = false;
      logger.error('Subscription error', error);
      if (onError) {
        onError(error);
      }
    }
    this._sendRequest('verto.subscribe', {
      eventChannel: this.channelId
    }, onRequestSuccess, onRequestError);
  }

  publish(eventData, onSuccess, onError) {
    logger.client('Publishing event', eventData);
    const encoded = this._encode(eventData);
    if (encoded) {
      const onRequestSuccess = (message) => {
        if ('code' in message.result) {
          if (onError) {
            onError(message);
          }
        } else {
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
      if (onError) {
        onError(eventData);
      }
    }
  }

  sendMessage(clientId, msgData, onSuccess, onError) {
    logger.client('Sending message', clientId, msgData);
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

  // Websocket event handlers

  _onWsConnect() {
    logger.info('Connected');
    this.onConnect();
    this._cleanResponseCallbacks();
    this.lastActive = new Date();
    clearTimeout(this.pingTimer);
    this.pingTimer = setTimeout(() => {
      this._ping();
    }, this._pingInterval());
    this.authing = false;
    this._sendRequest('login');
  }

  _onWsDisconnect() {
    this.isSubscribed = false;
    clearTimeout(this.pingTimer);
    const isTimeout = this._isTimeout();
    this.lastActive = null;
    if (isTimeout) {
      this.disconnect();
    }
    this._cleanResponseCallbacks();
    this.onDisconnect(isTimeout);
    logger.info('Disconnected');
  }

  _onWsMessage(event) {
    const message = this._parse(event.data);
    if (this.responseCallbacks[message.id]) {
      logger.debug('Received response', message);
      this._handleResponse(message);
    } else {
      logger.debug('Received event', message);
      this._handleEvent(message);
    }
  }

  // Constructor helper

  _initChannelData() {
    return this.channelData = JSON.parse(
      localStorage.getItem(this.channelId)
    ) || {};
  }

  // Session helpers

  _getUuid() {
    const url = URL.createObjectURL(new Blob());
    URL.revokeObjectURL(url);
    return url.split('/').pop();
  }

  _getSessionId(replace) {
    let sessionId = this.getChannelVar('sessionId');
    if (replace || !sessionId) {
      sessionId = this._getUuid();
      this.setChannelVar('sessionId', sessionId);
    }
    return sessionId;
  }

  _startSession(onSuccess, onError) {
    const sessionId = this._getSessionId();
    const url = `${location.href}/sessions?sessionId=${sessionId}`;
    fetch(url).then(response => {
      if (response.ok) {
        return response.json();
      } else {
        throw new Error(response.status);
      }
    }).then(loginData => {
      onSuccess(sessionId, loginData);
    }).catch(error => {
      if (error.message === '404') {
        const sessionId = this._getSessionId(true);
        const url = `${location.href}/sessions?sessionId=${sessionId}`;
        fetch(url).then(response => {
          if (response.ok) {
            return response.json();
          } else {
            throw new Error(response.status);
          }
        }).then(loginData => {
          onSuccess(sessionId, loginData);
        }).catch(error => {
          onError(error);
        });
      } else {
        onError(error);
      }
    });
  }

  _cleanResponseCallbacks() {
    const expired = [];
    const now = new Date();
    logger.client('Cleaning callbacks');
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

  _sendRequest(method, params, onSuccess, onError) {
    const request = new VertoRequest(
      this.sessionId,
      this._getUuid(),
      method,
      params
    );
    this.responseCallbacks[request.id] = new ResponseCallbacks(
      onSuccess, onError
    );
    logger.debug('Sending request', request);
    this.ws.send(request);
  }

  _login() {
    this.authing = true;
    const onSuccess = () => {
      logger.info('Logged in');
      this.authing = false;
      this.onLogin();
    };
    const onError = (event) => {
      logger.error('Login failed', event);
      this.disconnect();
      this.onLoginError(event.error.message);
    };
    this._sendRequest('login', {
      login: this.clientId,
      passwd: this.password
    }, onSuccess, onError);
  }

  // Ping activity helpers

  _isTimeout() {
    if (this.lastActive) {
      const timeout = new Date(this.lastActive.getTime() + 60000);
      if (new Date() > timeout) {
        return true;
      }
    }
    return false;
  }

  _addActivityListeners() {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.isConnected()) {
        this._ping();
      }
    });
  }

  _pingInterval() {
    const pingVary = Math.floor(
      Math.random() * (CONST.pingMaxVary * 2 + 1)
    ) - CONST.pingMaxVary;
    return (CONST.pingInterval + pingVary) * 1000;
  }

  _ping() {
    this._cleanResponseCallbacks();
    if (this.isConnected()) {
      if (this._isTimeout()) {
        this.disconnect();
      } else {
        const onError = (message) => {
          logger.error('Ping failed', message);
          this.onPingError(message);
        }
        const onSuccess = () => {
          clearTimeout(this.pingTimer);
          this.pingTimer = setTimeout(() => {
            this._ping();
          }, this._pingInterval());
          this.lastActive = new Date();
          this.onPing();
        }
        this._sendRequest('echo', {}, onSuccess, onError);
      }
    }
  }

  // WebSocket message handlers

  _handleResponse(message) {
    if (message.result) {
      const onSuccess = this.responseCallbacks[message.id].onSuccess;
      if (onSuccess) {
        onSuccess(message);
      }
    } else {
      if (message.error) {
        const code = parseInt(message.error.code);
        if (!this.authing && code === CONST.authRequired) {
          this._login();
        } else {
          const onError = this.responseCallbacks[message.id].onError;
          if (onError) {
            onError(message);
          }
        }
      } else {
        logger.error('Received bad response', message);
      }
    }
    delete this.responseCallbacks[message.id];
  }

  _handleEvent(event) {
    if (event.method === 'verto.clientReady') {
      logger.info('Ready');
      this.onReady(event.params);
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
        if (clientId && clientId === this.clientId) {
          logger.client('Received message', event, message);
          this.onMessage(msg.from, message);
        } else {
          logger.error('Received other message', event, message);
        }
      } else {
        logger.error('Received empty message', event);
      }
    } else if (event.method === 'verto.event') {
      if (
          event.params
          && event.params.sessid
          && event.params.sessid === this.sessionId) {
        logger.client('Received own event', event);
      } else if (
          event.params
          && event.params.userid
          && event.params.eventChannel
          && event.params.eventData) {
        if (event.params.eventChannel === this.channelId) {
          const clientId = event.params.userid.split('@').shift();
          const eventData = this._decode(event.params.eventData);
          logger.client('Received channel event', clientId, eventData);
          this.onEvent(clientId, eventData);
        } else {
          logger.error('Received other channel event', event);
        }
      } else {
        logger.error('Received bad channel event', event);
      }
    } else if (event.method === 'verto.punt') {
      logger.info('Received punt');
      this.disconnect();
      this.onPunt();
    } else {
      logger.error('Received bad event', event);
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
