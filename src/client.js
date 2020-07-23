/*
 *  Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 *  CC BY-NC-ND 4.0.
 */
import View from './view.js';
import MyWebSocket from './websocket.js';
import {debug, error} from './logger.js';

const CODES = {
  authRequired: -32000,
}

class Request {
  constructor(method, params, clientId, requestId) {
    this.jsonrpc = '2.0';
    this.method = method;
    this.params = {sessid: clientId, ...params};
    this.id = requestId;
  }
}

export default class Client {

  constructor() {
    this.view = new View(this);
    this.clientId = this.view.clientId;
    this.channelId = this.view.channelId;
    this.ws = new MyWebSocket();
    this.currentRequestId = 0;
    this.authing = false;
    this.callbacks = {};
    this.subscriptions = {};
    this.keepaliveTimer = null;
    this.keepaliveInterval = 45000;
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
    clearInterval(this.keepaliveTimer);
    // this.clearCallbacks();
    this.keepaliveTimer = setInterval(() => {
      this.ping();
    }, this.keepaliveInterval);
    this.authing = false;
    this.send('login');
  }

  disconnect() {
    this.ws.disconnect(
      this.disconnectHandler.bind(this),
    );
  }

  disconnectHandler(event) {
    clearInterval(this.keepaliveTimer);
    // this.clearCallbacks();
    debug('disconnected', event);
  }

  messageHandler(event) {
    try {
      let message = JSON.parse(event.data);
      debug('received', message);
      if (this.callbacks[message.id]) {
        this.responseHandler(message);
      } else {
        this.eventHandler(message);
      }
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  }

  responseHandler(message) {
    if (message.result) {
      const onSuccess = this.callbacks[message.id].onSuccess;
      if (onSuccess) {
        onSuccess(message);
      }
    } else {
      if (message.error) {
        const code = parseInt(message.error.code);
        if (!this.authing && code === CODES.authRequired) {
          this.login();
        } else {
          const onError = this.callbacks[message.id].onError;
          if (onError) {
            onError(message);
          }
        }
      } else {
        error('Bad response', message);
      }
    }
    delete this.callbacks[message.id];
  }

  eventHandler(event) {
    switch (event.method) {
      case 'verto.clientReady':
        this.subscribe(this.channelId);
        break;
      default:
        debug('unhandled event', event);
        break;
    }
  }

  // JSON-RPC API.

  send(method, params = {}, onSuccess = null, onError = null) {
    this.currentRequestId += 1;
    const request = new Request(
      method,
      params,
      this.clientId,
      this.currentRequestId
    );
    this.callbacks[request.id] = {
      onSuccess: onSuccess,
      onError: onError,
    };
    this.ws.send(request);
  }

  login() {
    this.authing = true;
    const onSuccess = () => {
      this.authing = false;
    };
    this.send('login', {
      login: this.clientId,
      passwd: this.clientId,
    }, onSuccess);
  }

  subscribe(eventChannel) {
    this.subscriptions[eventChannel] = {
      eventChannel: eventChannel,
      ready: false,
    }
    this.send('verto.subscribe', {eventChannel});
  }

  unsubscribe(eventChannel) {
    const onSuccess = () => {
      delete this.subscriptions[eventChannel];
    }
    this.send('verto.unsubscribe', {eventChannel}, onSuccess);
  }

  publish(eventChannel, data) {
    this.send('verto.broadcast', {
      localBroadcast: true,
      eventChannel,
      ...data,
    });
  }

  ping() {
    // this.clearCallbacks();
    if (this.ws.isConnected()) {
      this.send('echo');
    }
  }
}
