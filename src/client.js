/*
 * Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 * CC BY-NC-ND 4.0.
 */
import View from './view.js';
import MyWebSocket from './websocket.js';
import PeerConnection from './peer-connection.js';
import logger from './logger.js';

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
    this.view = new View();
    this.channelId = this.view.channelId;
    this.clientId = this.view.clientId;
    this.password = this.view.password;
    this.ws = new MyWebSocket();
    this.keepaliveTimer = null;
    this.currentRequestId = 0;
    this.authing = false;
    this.responseCallbacks = {};
    this.subscriptions = {};
    this.peer = null;
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
    logger.info('Connected');
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
    logger.info('Disconnected');
  }

  messageHandler(event) {
    try {
      let message = JSON.parse(event.data);
      logger.debug('Received', message);
      if (this.responseCallbacks[message.id]) {
        this.responseHandler(message);
      } else {
        this.eventHandler(message);
      }
    } catch (error) {
      logger.error('Error handling message', error);
      alert(error.message);
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
    logger.debug('Sending', request);
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
        logger.error('Bad response', message);
      }
    }
    delete this.responseCallbacks[message.id];
  }

  eventHandler(event) {
    switch (event.method) {
      case 'verto.clientReady':
        this.subscribe(this.channelId);
        break;
      case 'verto.info':
        this.handleMessage(event.params.msg);
        break;
      default:
        logger.error('Unhandled event', event);
        break;
    }
  }

  cleanResponseCallbacks() {
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

  // Client auth and socket keepalive methods.

  login() {
    this.authing = true;
    const onSuccess = () => {
      logger.info('Logged in');
      this.authing = false;
    };
    const onError = (message) => {
      this.disconnect();
      logger.error('Bad login', message);
    };
    this.send('login', {
      login: this.clientId,
      passwd: this.password,
    }, onSuccess, onError);
  }

  ping() {
    this.cleanResponseCallbacks();
    const onError = (message) => {
      logger.error('Bad ping response', message);
    }
    if (this.ws.isConnected()) {
      this.send('echo', {}, null, onError);
    }
  }

  // Channel pub/sub methods.

  // TODO These sub/unsub methods assume one subscription per request. The
  // verto API allows clients to subscribe to multiple channels with a single
  // request and returns allowed/existing subscriptions in a success response,
  // failed subscriptions in an error response.

  subscribe(eventChannel) {
    const onSuccess = () => {
      this.subscriptions[eventChannel] = {}
      logger.info('Subscribed to', eventChannel);
    }
    const onError = (message) => {
      logger.error('Bad sub response', message);
    }
    this.send('verto.subscribe', {
      eventChannel
    }, onSuccess, onError);
  }

  unsubscribe(eventChannel) {
    const onSuccess = () => {
      delete this.subscriptions[eventChannel];
      logger.info('Unsubscribed from', eventChannel);
    }
    const onError = (message) => {
      logger.error('Bad unsub response', message);
    }
    this.send('verto.unsubscribe', {
      eventChannel
    }, onSuccess, onError);
  }

  publish(eventChannel, data) {
    const onSuccess = (message) => {
      if ('code' in message.result) {
        logger.error('Bad pub response', message);
      }
    }
    const onError = (message) => {
      logger.error('Bad pub response', message);
    }
    this.send('verto.broadcast', {
      localBroadcast: true,
      eventChannel,
      ...data,
    }, onSuccess, onError);
  }

  // Peer-to-peer connection control methods.

  _initPeerConnection() {
    const trackHandler = (track) => {
      this.view.addTrack(track);
      logger.info('Added track to view', track.kind);
    }
    const candidateHandler = (jsonCandidate) => {
      const stringCandidate = JSON.stringify(jsonCandidate);
      this.sendMessage(this.peer.peerId, stringCandidate);
    }
    const offerHandler = (jsonSdp) => {
      const stringSdp = JSON.stringify(jsonSdp);
      this.sendMessage(this.peer.peerId, stringSdp);
    }
    this.peer.initPeerConnection(
      trackHandler, candidateHandler, offerHandler
    );
  }

  offerPeerConnection(peerId) {
    if (!this.peer) {
      const onSuccess = () => {
        this.sendMessage(this.peer.peerId, 'offer');
      };
      const onError = (error) => {
        throw error;
      };
      this.peer = new PeerConnection(peerId, true);
      this.peer.initLocalStream(onSuccess, onError);
    }
  }

  acceptPeerConnection(peerId) {
    if (!this.peer) {
      const onSuccess = () => {
        this.sendMessage(this.peer.peerId, 'accept');
        this._initPeerConnection();
      };
      const onError = (error) => {
        throw error;
      };
      this.peer = new PeerConnection(peerId, false);
      this.peer.initLocalStream(onSuccess, onError);
    }
  }

  closePeerConnection() {
    if (this.peer) {
      this.sendMessage(this.peer.peerId, 'close');
      this.view.removeTracks();
      this.peer.destroy();
      this.peer = null;
    }
  }

  // Peer-to-peer signal handlers.

  encode(str) {
    return btoa(encodeURIComponent(str).replace(
      /%([0-9A-F]{2})/g,
      (match, p1) => {
        return String.fromCharCode('0x' + p1);
      }
    ));
  }

  decode(str) {
    return decodeURIComponent(atob(str).split('').map((c) => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
  }

  sendMessage(to, body) {
    const onError = (message) => {
      logger.error('Bad response', message);
    }
    const encoded = this.encode(body);
    this.send('verto.info', {msg: {to: to, body: encoded}}, null, onError);
  }

  handleMessage(msg) {
    const decoded = this.decode(msg.body);
    if (decoded === 'offer') {
      this.handleOffer(msg.from);
    } else if (decoded === 'accept') {
      this.handleAccept(msg.from);
    } else if (decoded === 'close') {
      this.handleClose(msg.from);
    } else {
      let jsonData;
      try {
        jsonData = JSON.parse(decoded);
      } catch (error) {
        logger.error('Received unhandled message', msg, decoded);
        return;
      }
      if ('candidate' in jsonData) {
        this.handleCandidate(msg.from, jsonData);
      } else if ('sdp' in jsonData) {
        this.handleSdp(msg.from, jsonData);
      } else {
        logger.error('Received unhandled JSON message', msg, jsonData);
      }
    }
  }

  handleOffer(peerId) {
    if (this.peer) {
      if (this.peer.peerId !== peerId) {
        this.sendMessage(peerId, 'close');
      }
    } else {
      // TODO Tell view about the offer and let it decide.
      this.acceptPeerConnection(peerId);
    }
  }

  handleAccept(peerId) {
    if (this.peer && this.peer.peerId === peerId) {
      this._initPeerConnection();
    }
  }

  handleClose(peerId) {
    if (this.peer && this.peer.peerId === peerId) {
      this.view.removeTracks();
      this.peer.destroy();
      this.peer = null;
    }
  }

  handleCandidate(peerId, jsonCandidate) {
    if (this.peer && this.peer.peerId === peerId) {
      logger.debug('Received candidate', jsonCandidate);
      this.peer.addCandidate(jsonCandidate).then(() => {
      }).catch(error => {
        throw error;
      });
    }
  }

  handleSdp(peerId, jsonSdp) {
    if (this.peer && this.peer.peerId === peerId) {
      logger.debug('Received description', jsonSdp);
      const sendAnswerHandler = (newJsonSdp) => {
        const stringSdp = JSON.stringify(newJsonSdp);
        this.sendMessage(peerId, stringSdp);
      }
      this.peer.addDescription(jsonSdp, sendAnswerHandler).then(() => {
      }).catch(error => {
        throw error;
      });
    }
  }
}
