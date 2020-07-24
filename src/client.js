/*
 *  Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 *  CC BY-NC-ND 4.0.
 */
import View from './view.js';
import MyWebSocket from './websocket.js';
import {debug, info, error} from './logger.js';

const CONST = {
  authRequired: -32000,
  keepaliveInterval: 45000,
  requestExpiry: 30000,
}

class Request {
  constructor(method, params, clientId, requestId) {
    this.jsonrpc = '2.0';
    this.method = method;
    this.params = {sessid: clientId, ...params};
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
    this.view = new View(this); // Init callbacks instead.
    this.channelId = this.view.channelId;
    this.clientId = this.view.clientId;
    this.password = this.view.password;
    this.ws = new MyWebSocket();
    this.currentRequestId = 0;
    this.authing = false;
    this.responseCallbacks = {};
    this.subscriptions = {};
    this.keepaliveTimer = null;
  }

  // WebSocket methods/handlers.

  connect() {
    this.ws.connect(
      this.connectHandler.bind(this),
      this.disconnectHandler.bind(this),
      this.messageHandler.bind(this),
    );
  }

  connectHandler() {
    info('Connected');
    clearInterval(this.keepaliveTimer);
    this.cleanResponseCallbacks();
    this.keepaliveTimer = setInterval(() => {
      this.ping();
    }, CONST.keepaliveInterval);
    this.authing = false;
    this.send('login');
  }

  disconnect() {
    this.ws.disconnect(
      this.disconnectHandler.bind(this),
    );
  }

  disconnectHandler() {
    clearInterval(this.keepaliveTimer);
    this.cleanResponseCallbacks();
    info('Disconnected');
  }

  messageHandler(event) {
    try {
      let message = JSON.parse(event.data);
      debug('Received', message);
      if (this.responseCallbacks[message.id]) {
        this.responseHandler(message);
      } else {
        this.eventHandler(message);
      }
    } catch (err) {
      error('Error handling message', err);
      alert(err.message);
    }
  }

  // JSON-RPC request/response methods/handlers.

  send(method, params, onSuccess, onError) {
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
    debug('Sending', request);
    this.ws.send(request);
  }

  responseHandler(message) {
    if (message.result) {
      const onSuccess = this.responseCallbacks[message.id].onSuccess;
      if (onSuccess) {
        onSuccess(message);
      }
    } else {
      if (message.error) {
        const code = parseInt(message.error.code);
        if (!this.authing && code === CONST.authRequired) {
          this.login();
        } else {
          const onError = this.responseCallbacks[message.id].onError;
          if (onError) {
            onError(message);
          }
        }
      } else {
        error('Bad response', message);
      }
    }
    delete this.responseCallbacks[message.id];
  }

  eventHandler(event) {
    switch (event.method) {
      case 'verto.clientReady':
        this.subscribe(this.channelId);
        break;
      default:
        error('Unhandled event', event);
        break;
    }
  }

  cleanResponseCallbacks() {
    const expired = [];
    const now = new Date().setSeconds(-30);
    debug('Cleaning up expired response callbacks');
    for (const requestId in this.responseCallbacks) {
      const diff = now - this.responseCallbacks[requestId].sent;
      if (diff > CONST.requestExpiry) {
        expired.push(requestId);
      }
    }
    for (const requestId of expired) {
      delete this.responseCallbacks[requestId];
      error('Deleted expired callbacks for request', requestId);
    }
  }

  // Verto API.

  login() {
    this.authing = true;
    const onSuccess = () => {
      info('Logged in');
      this.authing = false;
    };
    const onError = (message) => {
      this.disconnect();
      error('Bad login', message);
    };
    this.send('login', {
      login: this.clientId,
      passwd: this.password,
    }, onSuccess, onError);
  }

  // TODO These sub/unsub methods assume one subscription per request. The
  // verto API allows clients to subscribe to multiple channels with a single
  // request and returns allowed subscriptions in a success response, failed
  // subscriptions in an error response.

  subscribe(eventChannel) {
    const onSuccess = () => {
      this.subscriptions[eventChannel] = {}
      info('Subscribed to', eventChannel);
    }
    const onError = (message) => {
      error('Bad sub response', message);
    }
    this.send('verto.subscribe', {
      eventChannel
    }, onSuccess, onError);
  }

  unsubscribe(eventChannel) {
    const onSuccess = () => {
      delete this.subscriptions[eventChannel];
      info('Unsubscribed from', eventChannel);
    }
    const onError = (message) => {
      error('Bad unsub response', message);
    }
    this.send('verto.unsubscribe', {
      eventChannel
    }, onSuccess, onError);
  }

  publish(eventChannel, data) {
    const onSuccess = (message) => {
      if ('code' in message.result) {
        error('Bad pub response', message);
      }
    }
    const onError = (message) => {
      error('Bad pub response', message);
    }
    this.send('verto.broadcast', {
      localBroadcast: true,
      eventChannel,
      ...data,
    }, onSuccess, onError);
  }

  ping() {
    this.cleanResponseCallbacks();
    const onError = (message) => {
      error('Bad ping response', message);
    }
    if (this.ws.isConnected()) {
      this.send('echo', {}, null, onError);
    }
  }
}
