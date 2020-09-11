/*
 * Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 * CC BY-NC-ND 4.0.
 */
import MyWebSocket from './websocket.js';
import logger from './logger.js';

const CONST = {
  authRequired: -32000,
  keepaliveInterval: 45,
  requestExpiry: 30,
}

class Request {
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

  constructor(channelId) {
    this.channelId = channelId;
    this.ws = new MyWebSocket();
    this.keepaliveTimer = null;
    this.lastPingDate = null;
    this._addPingOnFocusListener();
    this.currentRequestId = 0;
    this.authing = false;
    this.responseCallbacks = {};
    this.isSubscribed = false;
  }

  setConnectHandlers(connectHandler, disconnectHandler) {
    this.connectHandler = connectHandler;
    this.disconnectHandler = disconnectHandler;
  }

  setLoginHandlers(successHandler, failureHandler, readyHandler) {
    this.loginSuccessHandler = successHandler;
    this.loginFailureHandler = failureHandler;
    this.clientReadyHandler = readyHandler;
  }

  setMessageHandlers(presenceEventHandler, infoMsgHandler, puntHandler) {
    this.presenceEventHandler = presenceEventHandler;
    this.infoMsgHandler = infoMsgHandler;
    this.puntHandler = puntHandler;
  }

  isConnected() {
    return this.ws.isConnected();
  }

  connect() {
    if (!this.isConnected()) {
      const onSuccess = (sessionId, jsonData) => {
        this.sessionId = sessionId;
        this.clientId = jsonData.clientId;
        this.password = jsonData.password;
        this._wsConnect();
      }
      const onError = (error) => {
        this.loginFailureHandler(error.message);
      }
      this._startSession(onSuccess, onError);
    }
  }

  disconnect() {
    if (this.isConnected()) {
      if (this.isSubscribed) {
        this._publishDisconnect();
      }
      this.ws.disconnect(
        this._wsDisconnectHandler.bind(this),
      );
    } else {
      this.ws.halt();
    }
  }

  // Session maintenance methods.

  _getSessionId(replace = false) {
    const jsonData = JSON.parse(localStorage.getItem(this.channelId)) || {};
    let sessionId = jsonData.sessionId;
    if (replace || !sessionId) {
      const url = URL.createObjectURL(new Blob());
      URL.revokeObjectURL(url);
      sessionId = url.split('/').pop();
      jsonData.sessionId = sessionId;
      localStorage.setItem(this.channelId, JSON.stringify(jsonData));
      logger.info('New session', sessionId);
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
    }).then(jsonData => {
      onSuccess(sessionId, jsonData);
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
        }).then(jsonData => {
          onSuccess(sessionId, jsonData);
        }).catch(error => {
          onError(error);
        });
      } else {
        onError(error);
      }
    });
  }

  // Websocket maintenance methods.

  _wsConnect() {
    this.ws.connect(
      this._wsConnectHandler.bind(this),
      this._wsDisconnectHandler.bind(this),
      this._wsMessageHandler.bind(this),
    );
  }

  _wsConnectHandler() {
    this.connectHandler();
    clearTimeout(this.keepaliveTimer);
    this.lastPingDate = new Date();
    this._cleanResponseCallbacks();
    this.keepaliveTimer = setTimeout(() => {
      this._ping();
    }, CONST.keepaliveInterval * 1000);
    this.authing = false;
    this._sendRequest('login');
  }

  _wsDisconnectHandler() {
    clearTimeout(this.keepaliveTimer);
    let pingTimeout = false;
    if (this.lastPingDate) {
      const diff = new Date() - this.lastPingDate;
      if (diff > (CONST.keepaliveInterval * 1000) + 10000) {
        this.ws.halt();
        pingTimeout = true;
      }
    }
    this.lastPingDate = null;
    this._cleanResponseCallbacks();
    this.disconnectHandler(pingTimeout);
  }

  _wsMessageHandler(event) {
    try {
      let message = JSON.parse(event.data);
      logger.debug('Received', message);
      if (this.responseCallbacks[message.id]) {
        this._responseHandler(message);
      } else {
        this._eventHandler(message);
      }
    } catch (error) {
      logger.error('Error handling message', error);
      alert(error.message);
    }
  }

  // Client maintenance methods.

  _login() {
    this.authing = true;
    const onSuccess = () => {
      this.authing = false;
      this.loginSuccessHandler();
    };
    const onError = (event) => {
      this.disconnect();
      this.loginFailureHandler(event.error.message);
    };
    this._sendRequest('login', {
      login: this.clientId,
      passwd: this.password
    }, onSuccess, onError);
  }

  _ping() {
    this._cleanResponseCallbacks();
    const onError = (message) => {
      logger.error('Bad ping response', message);
    }
    const onSuccess = () => {
      this.lastPingDate = new Date();
      this.keepaliveTimer = setTimeout(() => {
        this._ping();
      }, CONST.keepaliveInterval * 1000);
    }
    if (this.isConnected()) {
      this._sendRequest('echo', {}, onSuccess, onError);
    }
  }

  _addPingOnFocusListener() {
    window.addEventListener('focus', () => {
      if (this.lastPingDate) {
        clearTimeout(this.keepaliveTimer);
        this._ping();
      }
    });
  }

  // Request/response/event handlers.

  _sendRequest(method, params, onSuccess, onError) {
    this.currentRequestId += 1;
    const request = new Request(
      method,
      params,
      this.sessionId,
      this.currentRequestId
    );
    this.responseCallbacks[request.id] = new ResponseCallbacks(
      onSuccess, onError
    );
    logger.debug('Sending', request);
    this.ws.send(request);
  }

  _cleanResponseCallbacks() {
    const expired = [];
    const now = new Date();
    logger.debug('Cleaning expired response callbacks');
    for (const requestId in this.responseCallbacks) {
      const diff = now - this.responseCallbacks[requestId].sent;
      if (diff > CONST.requestExpiry * 1000) {
        expired.push(requestId);
      }
    }
    for (const requestId of expired) {
      delete this.responseCallbacks[requestId];
      logger.error('Deleted expired callbacks for request', requestId);
    }
  }

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
    const method = event.method;
    if (method === 'verto.clientReady') {
      this.clientReadyHandler(this.clientId);
      this._subscribe();
    } else if (method === 'verto.info') {
      const msg = event.params.msg;
      if (msg) {
        this.infoMsgHandler(msg.from, this._decodeMessage(msg.body));
      } else {
        logger.error('Unhandled verto.info', event);
      }
    } else if (method === 'verto.event') {
      if (event.params.sessid === this.sessionId) {
        return;
      }
      if ('isAvailable' in event.params) {
        this.presenceEventHandler(
          event.params.userid.split('@').shift(),
          event.params.isAvailable
        );
      } else if ('isDisconnected' in event.params) {
        this.presenceEventHandler(
          event.params.userid.split('@').shift(),
          null
        );
      } else {
        logger.error('Unhandled verto.event', event);
      }
    } else if (method === 'verto.punt') {
      this.ws.halt();
      this.puntHandler(event);
    } else {
      logger.error('Unhandled event', event);
    }
  }

  // Client to client info messages.

  sendInfoMsg(clientId, body, log = true) {
    const onError = (message) => {
      logger.error('Error sending message', message);
    }
    const onSuccess = () => {
      if (log) {
        logger.info('Sent', body, 'to', clientId);
      }
    }
    const encoded = this._encodeMessage(body);
    this._sendRequest('verto.info', {
      msg: {to: clientId, body: encoded}
    }, onSuccess, onError);
  }

  _encodeMessage(str) {
    return btoa(encodeURIComponent(str).replace(
      /%([0-9A-F]{2})/g,
      (match, p1) => {
        return String.fromCharCode('0x' + p1);
      }
    ));
  }

  _decodeMessage(str) {
    return decodeURIComponent(atob(str).split('').map((c) => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
  }

  // Channel presence maintenance methods.

  publishPresence(isAvailable) {
    const onSuccess = (message) => {
      if ('code' in message.result) {
        logger.error('Bad pub response', message);
      }
    }
    const onError = (message) => {
      logger.error('Bad pub response', message);
    }
    this._sendRequest('verto.broadcast', {
      localBroadcast: true,
      eventChannel: this.channelId,
      isAvailable: isAvailable,
    }, onSuccess, onError);
  }

  _subscribe() {
    const onSuccess = () => {
      logger.info('Subscribed');
      this.isSubscribed = true;
      this.publishPresence(true);
    }
    const onError = (message) => {
      logger.error('Bad sub response', message);
    }
    this._sendRequest('verto.subscribe', {
      eventChannel: this.channelId
    }, onSuccess, onError);
  }

  _publishDisconnect() {
    this._sendRequest('verto.broadcast', {
      localBroadcast: true,
      eventChannel: this.channelId,
      isDisconnected: true,
    }, null, null);
  }
}
