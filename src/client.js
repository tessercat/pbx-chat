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
  constructor(method, params, sessid, requestId) {
    this.jsonrpc = '2.0';
    this.method = method;
    this.params = {sessid, ...params};
    this.id = requestId;
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
    this.ws = new MyWebSocket();
    this._setWsListeners();
    this.pingTimer = null;
    this.lastActive = null;
    this._addActivityListeners();
    this.currentRequestId = 0;
    this.authing = false;
    this.responseCallbacks = {};
    this.sessionData = this._initSessionData();
    this.isSubscribed = false;
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

  // Channel client interface.

  getSessionData(key) {
    return this.sessionData[key] || null;
  }

  setSessionData(key, value) {
    let changed = false;
    if (value && value !== this.sessionData[key]) {
      changed = true;
      this.sessionData[key] = value;
      logger.info('Set session', key);
    } else if (this.sessionData[key] && !value) {
      changed = true;
      delete this.sessionData[key];
      logger.info('Deleted session', key);
    }
    if (changed) {
      localStorage.setItem(
        this.channelId, JSON.stringify(this.sessionData)
      );
    }
    return changed;
  }

  isConnected() {
    return this.ws.isConnected();
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
    this.onDisconnect();
    this.ws.disconnect();
  }

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
    logger.client('Broadcast', eventData);
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
    const encoded = this._encode(eventData);
    if (encoded) {
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
    logger.client('Send', clientId, msgData);
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

  // Websocket event handlers.

  _setWsListeners() {
    this.ws.onConnect = this._wsConnectHandler.bind(this);
    this.ws.onDisconnect = this._wsDisconnectHandler.bind(this);
    this.ws.onMessage = this._wsMessageHandler.bind(this);
  }

  _wsConnectHandler() {
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

  _wsDisconnectHandler() {
    this.isSubscribed = false;
    clearTimeout(this.pingTimer);
    const isTimeout = this._isTimeout();
    this.lastActive = null;
    this.onDisconnect(isTimeout);
    if (isTimeout) {
      this.disconnect();
    }
    logger.info('Disconnected');
  }

  _wsMessageHandler(event) {
    const message = this._parse(event.data);
    if (this.responseCallbacks[message.id]) {
      logger.debug('Raw response', message);
      this._responseHandler(message);
    } else {
      logger.debug('Raw event', message);
      this._eventHandler(message);
    }
  }

  // Connection and verto session maintenance methods.

  _initSessionData() {
    return this.sessionData = JSON.parse(
      localStorage.getItem(this.channelId)
    ) || {};
  }

  _getSessionId(replace) {
    let sessionId = this.getSessionData('sessionId');
    if (replace || !sessionId) {
      const url = URL.createObjectURL(new Blob());
      URL.revokeObjectURL(url);
      sessionId = url.split('/').pop();
      this.setSessionData('sessionId', sessionId);
    }
    return sessionId;
  }

  _startSession(onSuccess, onError) {
    let sessionId = this._getSessionId();
    let url = `${location.href}/sessions?sessionId=${sessionId}`;
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
        let sessionId = this._getSessionId(true);
        let url = `${location.href}/sessions?sessionId=${sessionId}`;
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
    this.currentRequestId += 1;
    const request = new VertoRequest(
      method,
      params,
      this.sessionId,
      this.currentRequestId
    );
    this.responseCallbacks[request.id] = new ResponseCallbacks(
      onSuccess, onError
    );
    logger.debug('Request', method, params);
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

  _isTimeout() {
    if (this.lastActive) {
      const timeout = new Date(this.lastActive.getTime() + 60000);
      if (new Date() > timeout) {
        return true;
      }
    }
    return false;
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

  _addActivityListeners() {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.isConnected()) {
        this._ping();
      }
    });
  }

  // Verto JSON-RPC response and event handlers.

  _responseHandler(message) {
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
        logger.error('Bad response', message);
      }
    }
    delete this.responseCallbacks[message.id];
  }

  _eventHandler(event) {
    if (event.method === 'verto.clientReady') {
      logger.info('Ready');
      this.onReady();
    } else if (event.method === 'verto.info') {
      const msg = event.params.msg;
      if (msg) {
        const decoded = this._decode(msg.body);
        logger.client('Info', msg.from, decoded);
        this.onMessage(msg.from, decoded);
      } else {
        logger.error('Bad info', event);
      }
    } else if (event.method === 'verto.event') {
      if (event.params.sessid === this.sessionId) {
        return;
      }
      const clientId = event.params.userid.split('@').shift();
      const decoded = this._decode(event.params.eventData);
      logger.client('Event', clientId, decoded);
      this.onEvent(clientId, decoded);
    } else if (event.method === 'verto.punt') {
      logger.info('Punt');
      this.disconnect();
      this.onPunt(event);
    } else {
      logger.error('Bad event', event);
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
