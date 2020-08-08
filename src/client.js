/*
 * Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 * CC BY-NC-ND 4.0.
 */
import MyWebSocket from './websocket.js';
import logger from './logger.js';

const CONST = {
  authRequired: -32000,
  keepaliveInterval: 45000,
  requestExpiry: 30000,
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

  constructor(clientId) {
    this.clientId = clientId;
    this.ws = new MyWebSocket();
    this.keepaliveTimer = null;
    this.currentRequestId = 0;
    this.authing = false;
    this.responseCallbacks = {};
    this.isSubscribed = false;
  }

  // Public methods.

  setMessageHandlers(presenceEventHandler, infoMsgHandler) {
    this.presenceEventHandler = presenceEventHandler;
    this.infoMsgHandler = infoMsgHandler;
  }

  connect(username, password, channelId) {
    this.username = username;
    this.password = password;
    this.channelId = channelId;
    this.ws.connect(
      this._wsConnectHandler.bind(this),
      this._wsDisconnectHandler.bind(this),
      this._wsMessageHandler.bind(this),
    );
  }

  disconnect() {
    this._publishDisconnect();
    this.ws.disconnect(
      this._wsDisconnectHandler.bind(this),
    );
  }

  publishPresence(isAvailable) {
    const onSuccess = (message) => {
      if ('code' in message.result) {
        logger.error('Bad pub response', message);
      }
    }
    const onError = (message) => {
      logger.error('Bad pub response', message);
    }
    this._send('verto.broadcast', {
      localBroadcast: true,
      eventChannel: this.channelId,
      isAvailable: isAvailable,
    }, onSuccess, onError);
  }

  sendInfoMsg(clientId, body) {
    const onError = (message) => {
      logger.error('Bad response', message);
    }
    const encoded = this._encodeMessage(body);
    this._send('verto.info', {
      msg: {to: clientId, body: encoded}
    }, null, onError);
  }

  // Websocket event handlers.

  _wsConnectHandler() {
    logger.info('Connected');
    clearInterval(this.keepaliveTimer);
    this._cleanResponseCallbacks();
    this.keepaliveTimer = setInterval(() => {
      this._ping();
    }, CONST.keepaliveInterval);
    this.authing = false;
    this._send('login');
  }

  _wsDisconnectHandler() {
    clearInterval(this.keepaliveTimer);
    this._cleanResponseCallbacks();
    logger.info('Disconnected');
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

  // Info message helpers.

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

  // Response/event message handling helpers.

  _cleanResponseCallbacks() {
    const expired = [];
    const now = new Date().setSeconds(-30);
    logger.debug('Cleaning up expired response callbacks');
    for (const requestId in this.responseCallbacks) {
      const diff = now - this.responseCallbacks[requestId].sent;
      if (diff > CONST.requestExpiry) {
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
      this._subscribe();
    } else if (method === 'verto.info') {
      const msg = event.params.msg;
      if (msg) {
        this.infoMsgHandler(msg.from, this._decodeMessage(msg.body));
      } else {
        logger.error('Unhandled verto.info', event);
      }
    } else if (method === 'verto.event') {
      if (event.params.sessid === this.clientId) {
        return;
      }
      if ('isAvailable' in event.params) {
        this.presenceEventHandler(
          event.params.sessid, event.params.isAvailable
        );
      } else if ('isDisconnected' in event.params) {
        this.presenceEventHandler(event.params.sessid, null);
      } else {
        logger.error('Unhandled verto.event', event);
      }
    } else {
      logger.error('Unhandled event', event);
    }
  }

  // Private JSON-RPC methods.

  _send(method, params, onSuccess, onError) {
    this.currentRequestId += 1;
    const request = new Request(
      method,
      params,
      this.clientId,
      this.currentRequestId
    );
    this.responseCallbacks[request.id] = new ResponseCallbacks(
      onSuccess, onError
    );
    logger.debug('Sending', request);
    this.ws.send(request);
  }

  _login() {
    this.authing = true;
    const onSuccess = () => {
      logger.info('Logged in');
      this.authing = false;
    };
    const onError = (message) => {
      this.disconnect();
      logger.error('Bad login', message);
    };
    this._send('login', {
      login: this.username,
      passwd: this.password
    }, onSuccess, onError);
  }

  _ping() {
    this._cleanResponseCallbacks();
    const onError = (message) => {
      logger.error('Bad ping response', message);
    }
    if (this.ws.isConnected()) {
      this._send('echo', {}, null, onError);
    }
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
    this._send('verto.subscribe', {
      eventChannel: this.channelId
    }, onSuccess, onError);
  }

  _publishDisconnect() {
    this._send('verto.broadcast', {
      localBroadcast: true,
      eventChannel: this.channelId,
      isDisconnected: true,
    }, null, null);
  }
}
