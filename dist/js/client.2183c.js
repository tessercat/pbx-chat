/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/js/client/client.js":
/*!*********************************!*\
  !*** ./src/js/client/client.js ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ VertoActionClient)
/* harmony export */ });
/* harmony import */ var _logger_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../logger.js */ "./src/js/logger.js");
/* harmony import */ var _local_media_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../local-media.js */ "./src/js/local-media.js");
/* harmony import */ var _verto_client_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../verto/client.js */ "./src/js/verto/client.js");
/* harmony import */ var _verto_peer_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../verto/peer.js */ "./src/js/verto/peer.js");
/*
 * Copyright (c) 2021 Peter Christensen. All Rights Reserved.
 * CC BY-NC-ND 4.0.
 */





class VertoActionClient {

  constructor() {

    const wssUrl = `wss://${location.host}/verto`
    this.channelId = location.pathname.split('/').pop();
    this.client = new _verto_client_js__WEBPACK_IMPORTED_MODULE_2__.default(wssUrl, this.channelId);
    this.client.getSessionData = this._getSessionData.bind(this);
    this.client.onEvent = this._onEvent.bind(this);
    this.client.onLoginError = this.close.bind(this);

    this.audio = document.getElementById('audio');
    this.video = document.getElementById('video');

    this.localMedia = new _local_media_js__WEBPACK_IMPORTED_MODULE_1__.default();
    this.localMedia.onStart = this._onMediaStart.bind(this);

    const stunPort = document.getElementById('stun-port').value
    const stunUrl = `stun:${location.host}:${stunPort}`
    this.peer = new _verto_peer_js__WEBPACK_IMPORTED_MODULE_3__.default(stunUrl, false);
    this.peer.onBundleReady = this._onBundleReady.bind(this);
    this.peer.onRemoteTrack = this._onPeerTrack.bind(this);

    this.callID = null;
    this.remoteSdp = null;
  }

  open() {
    if (this.audio) {
      this.localMedia.start(true, false);
    } else if (this.video) {
      this.localMedia.start(true, true);
    }
  }

  close() {
    if (this.audio) {
      if (this.audio.srcObject) {
        for (const track of this.audio.srcObject.getTracks()) {
          track.stop();
        }
        this.audio.srcObject = null;
      }
    } else if (this.video) {
      this.video.style.display = 'none';
      if (this.video.srcObject) {
        for (const track of this.video.srcObject.getTracks()) {
          track.stop();
        }
        this.video.srcObject = null;
      }
    }
    this.peer.close();
    this.localMedia.stop();
    this.client.close();
    this.callID = null;
  }

  // Verto client callbacks

  _getSessionData(sessionId, onSuccess, onError) {
    const url = `${location.href}/session?sessionId=${sessionId}`;
    fetch(url).then(response => {
      if (response.ok) {
        return response.json();
      } else {
        throw new Error(response);
      }
    }).then(sessionData => {
      onSuccess(sessionData);
    }).catch(error => {
      this.close();
      onError(error);
    });
  }

  _onEvent(event) {
    if (event.method === 'verto.answer') {
      if (this.remoteSdp) {
        this.peer.setRemoteDescription('answer', this.remoteSdp);
        this.remoteSdp = null;
      }
    } else if (event.method === 'verto.attach') {
      this.callID = event.params.callID;
      this.remoteSdp = event.params.sdp;
    } else if (event.method === 'verto.clientReady') {
      _logger_js__WEBPACK_IMPORTED_MODULE_0__.default.info('channel', 'Client ready');
      this.peer.init();
      this.peer.addTracks(this.localMedia.stream);
      if (this.remoteSdp) {
        this.peer.setRemoteDescription('offer', this.remoteSdp);
        this.remoteSdp = null;
      }
    } else if (event.method === 'verto.media') {
      this.remoteSdp = event.params.sdp;
    } else {
      _logger_js__WEBPACK_IMPORTED_MODULE_0__.default.error('channel', 'Unhandled event', event)
    }
  }

  // Local media callbacks

  _onMediaStart() {
    this.client.open();
  }

  // Verto peer callbacks

  _onBundleReady(sdpData) {
    const onSuccess = (message) => {
      _logger_js__WEBPACK_IMPORTED_MODULE_0__.default.info('channel', 'Bundle sent', message.result);
    }
    const onError = (error) => {
      _logger_js__WEBPACK_IMPORTED_MODULE_0__.default.error('channel', 'Invite failed', error);
    }
    let method = null;
    if (this.callID) {
      method = 'verto.attach'
    } else {
      this.callID = this.client.newUuid();
      method = 'verto.invite'
    }
    this.client.sendRequest(method, {
      sdp: sdpData,
      dialogParams: {
        callID: this.callID,
        destination_number: this.client.channelId,
        //screenShare: true,
        //dedEnc: true,
        //mirrorInput: true,
        //conferenceCanvasID: <int>,
        //outgoingBandwidth: <bw-str>,
        //incomingBandwidth: <bw-str>,
        //userVariables: {},
        //caller_id_name: <str>,
        //remote_caller_id_number: <str>,
        //remote_caller_id_name: <str>,
        //ani: <str>,
        //aniii: <str>,
        //rdnis: <str>,
      }
    }, onSuccess, onError);
  }

  _onPeerTrack(track) {
    _logger_js__WEBPACK_IMPORTED_MODULE_0__.default.info('channel', 'Adding track', track);
    if (!this.audio.srcObject) {
      this.audio.srcObject = new MediaStream();
    }
    this.audio.srcObject.addTrack(track);
    //this.audio.style.display = 'unset';
  }
}


/***/ }),

/***/ "./src/js/local-media.js":
/*!*******************************!*\
  !*** ./src/js/local-media.js ***!
  \*******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ LocalMedia)
/* harmony export */ });
/* harmony import */ var _logger_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./logger.js */ "./src/js/logger.js");
/*
 * Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 * CC BY-NC-ND 4.0.
 */


class LocalMedia {

  constructor() {
    this.stream = null;
    this.isStarting = false;

    // Event handlers
    this.onStart = null;
    this.onStop = null;
    this.onStartError = null;
  }

  start(audio = true, video = false) {
    const onSuccess = (stream) => {
      if (!this.isStarting) {

        /*
         * This runs when stop is called before getUserMedia returns.
         *
         * In September of 2020, there must be some kind of race condition
         * in Android Chromium (Android 10 Chrome, Android 6 Vivaldi)
         * when media stream tracks are stopped too soon after starting.
         *
         * Tracks are live before they're stopped, and ended after,
         * but stopping them so soon after starting must leave a reference
         * behind somewhere, because the browser shows media devices
         * as active, even after stream tracks close.
         *
         * A slight pause before stopping tracks seems to take care
         * of the problem.
         *
         * I haven't seen this in Firefox, Chromium or Vivaldi on Linux,
         * so I assume it's Android only.
         */

        const sleep = () => new Promise((resolve) => setTimeout(resolve, 500));
        sleep().then(() => {
          this._stopStream(stream);
        });
      } else {
        this.isStarting = false;
        this.stream = stream;
      }
    }
    const onError = (error) => {
      this.isStarting = false;
      _logger_js__WEBPACK_IMPORTED_MODULE_0__.default.error('media', error);
      if (this.onStartError) {
        this.onStartError(error);
      }
    }
    if (!this.stream && !this.isStarting) {
      this.isStarting = true;
      this._initStream(audio, video, onSuccess, onError);
    }
  }

  stop() {
    this.isStarting = false;
    this._stopStream(this.stream);
    this.stream = null;
  }

  async _initStream(audio, video, onSuccess, onError) {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      let hasAudio = false;
      let hasVideo = false;
      for (const device of devices) {
        if (device.kind.startsWith('audio')) {
          _logger_js__WEBPACK_IMPORTED_MODULE_0__.default.debug('media', 'Found audio device');
          hasAudio = true;
        } else if (device.kind.startsWith('video')) {
          _logger_js__WEBPACK_IMPORTED_MODULE_0__.default.debug('media', 'Found video device');
          hasVideo = true;
        }
      }
      if (audio && !hasAudio) {
        throw new Error('No audio devices.');
      }
      if (video && !hasVideo) {
        throw new Error('No video devices.');
      }
      const constraints = {audio, video};
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (this.onStart) {
        this.onStart(stream);
      }
      onSuccess(stream);
    } catch (error) {
      onError(error);
    }
  }

  _stopStream(stream) {
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
        _logger_js__WEBPACK_IMPORTED_MODULE_0__.default.debug('media', 'Stopped', track.kind, 'track');
      }
      if (this.onStop) {
        this.onStop(stream);
      }
    }
  }
}


/***/ }),

/***/ "./src/js/logger.js":
/*!**************************!*\
  !*** ./src/js/logger.js ***!
  \**************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/*
 *  Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 *  CC BY-NC-ND 4.0.
 */
function _getPrefix(prefix) {
  return `[${prefix} ${new Date().toLocaleTimeString()}]`;
}

let logger = {
  debug: (prefix, ...args) => {
    if (document.debugLogEnabled) {
      console.debug(_getPrefix(prefix), ...args);
    }
  },
  info: (prefix, ...args) => {
    if (document.infoLogEnabled) {
      console.log(_getPrefix(prefix), ...args);
    }
  },
  error: (prefix, ...args) => {
    console.error(_getPrefix(prefix), ...args);
  }
}
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (logger);


/***/ }),

/***/ "./src/js/verto/client.js":
/*!********************************!*\
  !*** ./src/js/verto/client.js ***!
  \********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ VertoClient)
/* harmony export */ });
/* harmony import */ var _socket_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./socket.js */ "./src/js/verto/socket.js");
/* harmony import */ var _logger_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../logger.js */ "./src/js/logger.js");
/*
 * Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 * CC BY-NC-ND 4.0.
 */



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

class VertoClient {

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
    this.socket = new _socket_js__WEBPACK_IMPORTED_MODULE_0__.default(wssUrl);
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
    _logger_js__WEBPACK_IMPORTED_MODULE_1__.default.debug('client', 'Request', request);
    this.socket.send(request);
  }

  // Verto socket event handlers

  _onSocketOpen() {
    let allowRetry = true;
    const onSuccess = (sessionData) => {
      if (sessionData.sessionId !== this._getSessionId()) {
        _logger_js__WEBPACK_IMPORTED_MODULE_1__.default.error('client', 'Bad sessionId', sessionData);
        this.close();
      } else if (!CONST.uuidRegExp.test(sessionData.clientId)) {
        _logger_js__WEBPACK_IMPORTED_MODULE_1__.default.error('client', 'Bad clientId', sessionData);
        this.close();
      } else if (!CONST.uuidRegExp.test(sessionData.password)) {
        _logger_js__WEBPACK_IMPORTED_MODULE_1__.default.error('client', 'Bad password', sessionData);
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
        _logger_js__WEBPACK_IMPORTED_MODULE_1__.default.error('client', 'Session data error', error);
        this.close();
      }
    }
    _logger_js__WEBPACK_IMPORTED_MODULE_1__.default.debug('client', 'Socket open');
    this._resetClientState();
    this.getSessionData(this._getSessionId(), onSuccess, onError);
    if (this.onOpen) {
      this.onOpen();
    }
  }

  _onSocketClose() {
    _logger_js__WEBPACK_IMPORTED_MODULE_1__.default.debug('client', 'Socket closed');
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
      _logger_js__WEBPACK_IMPORTED_MODULE_1__.default.error('client', 'Event data parse error', event, error);
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
    _logger_js__WEBPACK_IMPORTED_MODULE_1__.default.debug('client', 'Cleaning callbacks');
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
      _logger_js__WEBPACK_IMPORTED_MODULE_1__.default.error('client', 'Deleted callback', requestId);
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
      _logger_js__WEBPACK_IMPORTED_MODULE_1__.default.debug('client', 'Set', key);
    } else if (this.channelData[key] && !value) {
      changed = true;
      delete this.channelData[key];
      _logger_js__WEBPACK_IMPORTED_MODULE_1__.default.debug('client', 'Unset', key);
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
        _logger_js__WEBPACK_IMPORTED_MODULE_1__.default.error('client', 'Ping error', message);
      }
    }
    const onSuccess = () => {
      _logger_js__WEBPACK_IMPORTED_MODULE_1__.default.debug('client', 'Ping success');
      if (this.onPing) {
        this.onPing();
      }
      const delay = this._pingInterval();
      _logger_js__WEBPACK_IMPORTED_MODULE_1__.default.debug('client', `Waiting ${delay} before next ping`);
      this.pingTimer = setTimeout(this._ping.bind(this), delay);
    }
    _logger_js__WEBPACK_IMPORTED_MODULE_1__.default.debug('client', 'Ping');
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
      _logger_js__WEBPACK_IMPORTED_MODULE_1__.default.debug('client', 'Logged in');
      this.isAuthing = false;
      this.isAuthed = true;
      const delay = this._pingInterval();
      _logger_js__WEBPACK_IMPORTED_MODULE_1__.default.debug('client', `Waiting ${delay} before ping`);
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
        _logger_js__WEBPACK_IMPORTED_MODULE_1__.default.error('client', 'Login failed', event);
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
      _logger_js__WEBPACK_IMPORTED_MODULE_1__.default.debug('client', 'Response', message);
      const onSuccess = this.responseCallbacks[message.id].onSuccess;
      if (onSuccess) {
        onSuccess(message);
      }
    } else {
      if (message.error) {
        const code = parseInt(message.error.code);
        if (code === CONST.authRequired) {
          _logger_js__WEBPACK_IMPORTED_MODULE_1__.default.debug('client', 'Response auth required', message);
          this._login();
        } else {
          _logger_js__WEBPACK_IMPORTED_MODULE_1__.default.error('client', 'Response error', message);
          const onError = this.responseCallbacks[message.id].onError;
          if (onError) {
            onError(message);
          }
        }
      } else {
        _logger_js__WEBPACK_IMPORTED_MODULE_1__.default.error('client', 'Response unhandled', message);
      }
    }
    delete this.responseCallbacks[message.id];
  }

  _handleEvent(event) {
    if (event.method === 'verto.punt') {
      _logger_js__WEBPACK_IMPORTED_MODULE_1__.default.debug('client', 'Punt');
      this.close();
      if (this.onPunt) {
        this.onPunt();
      }
    } else {
      _logger_js__WEBPACK_IMPORTED_MODULE_1__.default.debug('client', 'Event', event);
      if (this.onEvent) {
        this.onEvent(event);
      }
    }
  }
}


/***/ }),

/***/ "./src/js/verto/peer.js":
/*!******************************!*\
  !*** ./src/js/verto/peer.js ***!
  \******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ VertoPeer)
/* harmony export */ });
/* harmony import */ var _logger_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../logger.js */ "./src/js/logger.js");
/*
 * Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 * CC BY-NC-ND 4.0.
 */


class VertoPeer {

  constructor(stunUrl, isPolite) {
    this.stunUrl = stunUrl;
    this.isPolite = isPolite;
    this.pc = null;
    this.isOffering = false;
    this.isIgnoringOffers = false;

    // Event handlers
    this.onConnected = null;
    this.onClosed = null;
    this.onFailed = null;
    this.onIceData = null;
    this.onSdpOffer = null;
    this.onBundleReady = null;
    this.onRemoteTrack = null;
  }

  init() {
    if (!this.pc) {
      this.pc = this._newConnection();
      this.isOffering = false;
      this.isIgnoringOffers = false;
    }
  }

  close() {
    if (this.pc && this.pc.connectionState !== 'closed') {
      this.pc.close();
      this.pc = null;
    }
  }

  addTracks(stream) {
    for (const track of stream.getTracks()) {
      _logger_js__WEBPACK_IMPORTED_MODULE_0__.default.debug('peer', 'Sending', track.kind);
      this.pc.addTrack(track, stream);
    }
  }

  _newConnection() {
    const config = {
      iceServers: [{urls: this.stunUrl}],
      bundlePolicy: 'max-compat',
      sdpSemantics: 'plan-b',
    }
    const pc = new RTCPeerConnection(config);
    pc.ontrack = (event) => {
      if (event.track) {
        _logger_js__WEBPACK_IMPORTED_MODULE_0__.default.debug('peer', 'Receiving media', event.track);
        if (this.onRemoteTrack) {
          this.onRemoteTrack(event.track);
        }
      }
    };
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const candidate = event.candidate.toJSON();
        _logger_js__WEBPACK_IMPORTED_MODULE_0__.default.debug('peer', 'Offering candidate', candidate)
        if (this.onIceData) {
          this.onIceData(candidate);
        }
      }
    };
    pc.onicegatheringstatechange = async () => {
      if (pc.iceGatheringState === 'complete' && pc.localDescription) {
        const sdp = pc.localDescription.toJSON();
        _logger_js__WEBPACK_IMPORTED_MODULE_0__.default.debug('peer', 'Bundle ready', sdp)
        if (this.onBundleReady) {
          this.onBundleReady(sdp.sdp);
        }
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        _logger_js__WEBPACK_IMPORTED_MODULE_0__.default.debug('peer', 'Connected');
        if (this.onConnected) {
          this.onConnected();
        }
      } else if (pc.connectionState === 'closed') {
        _logger_js__WEBPACK_IMPORTED_MODULE_0__.default.debug('peer', 'Closed');
        if (this.onClosed) {
          this.onClosed();
        }
      } else if (pc.connectionState === 'failed') {
        _logger_js__WEBPACK_IMPORTED_MODULE_0__.default.debug('peer', 'Failed');
        if (this.onFailed) {
          this.onFailed();
        }
      }
    }
    pc.onnegotiationneeded = async () => {
      try {
        this.isOffering = true;
        const offer = await pc.createOffer();
        if (pc.signalingState !== 'stable') {
          _logger_js__WEBPACK_IMPORTED_MODULE_0__.default.debug('peer', 'Abandoned offer');
          return;
        }
        await pc.setLocalDescription(offer);
        if (pc.localDescription) {
          const sdp = pc.localDescription.toJSON();
          _logger_js__WEBPACK_IMPORTED_MODULE_0__.default.debug('peer', 'Offering', sdp)
          if (this.onSdpOffer) {
            this.onSdpOffer(sdp);
          }
        }
      } catch (error) {
        _logger_js__WEBPACK_IMPORTED_MODULE_0__.default.error('rtp', 'Negotiation error', error);
      } finally {
        this.isOffering = false;
      }
    };
    return pc;
  }

  // Inbound signal handlers.

  async addIceCandidate(candidate) {
    try {
      await this.pc.addIceCandidate(candidate);
    } catch (error) {
      if (!this.isIgnoringOffers) {
        _logger_js__WEBPACK_IMPORTED_MODULE_0__.default.error('Received bad ICE data', candidate);
      }
    }
  }

  async setRemoteDescription(type, sdpString, onAnswer) {
    const sdp = new RTCSessionDescription({type: type, sdp: sdpString});
    const isOfferCollision = (
      sdp.type === 'offer'
      && (this.isOffering || this.pc.signalingState !== 'stable')
    );
    this.isIgnoringOffers = !this.isPolite && isOfferCollision;
    if (this.isIgnoringOffers) {
      _logger_js__WEBPACK_IMPORTED_MODULE_0__.default.debug('peer', 'Ignored offer', sdp);
      return;
    }
    if (isOfferCollision) {
      await Promise.all([
        this.pc.setLocalDescription({type: "rollback"}).catch((error) => {
          _logger_js__WEBPACK_IMPORTED_MODULE_0__.default.error('rtp', 'Rollback error', error);
        }),
        this.pc.setRemoteDescription(sdp)
      ]);
      _logger_js__WEBPACK_IMPORTED_MODULE_0__.default.debug('rtp', 'Rolled back offer');
    } else {
      await this.pc.setRemoteDescription(sdp);
      _logger_js__WEBPACK_IMPORTED_MODULE_0__.default.debug('peer', 'Accepted offer', sdp);
    }
    if (sdp.type === 'offer') {
      await this.pc.setLocalDescription(await this.pc.createAnswer());
      const sdp = this.pc.localDescription.toJSON();
      _logger_js__WEBPACK_IMPORTED_MODULE_0__.default.debug('peer', 'Sending answer', sdp);
      if (onAnswer) {
        onAnswer(sdp);
      }
    }
  }
}


/***/ }),

/***/ "./src/js/verto/socket.js":
/*!********************************!*\
  !*** ./src/js/verto/socket.js ***!
  \********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ VertoSocket)
/* harmony export */ });
/* harmony import */ var _logger_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../logger.js */ "./src/js/logger.js");
/*
 *  Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 *  CC BY-NC-ND 4.0.
 */


class VertoSocket {

  constructor(wssUrl) {
    this.wssUrl = wssUrl;
    this.socket = null;
    this.isOpening = false;
    this.isHalted = true;
    this.retryCount = 0;
    this.retryBackoff = 5 * 1000;
    this.retryMaxWait = 30 * 1000;
    this.retryRange = 5 * 1000;
    this.retryTimer = null;

    // Events bindings
    this.onOpen = null;
    this.onClose = null;
    this.onMessage = null;
  }

  _retryInterval() {
    let delay = this.retryCount * this.retryBackoff;
    if (delay > this.retryMaxWait) {
      delay = this.retryMaxWait;
    }
    if (delay) {
      const minDelay = delay - this.retryRange;
      const maxDelay = delay + this.retryRange;
      delay = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay);
    }
    return delay;
  }

  isOpen() {
    return this.socket && this.socket.readyState <= 1;
  }

  open() {
    if (this.isOpen() || this.isOpening) {
      return;
    }
    this.isOpening = true;
    this.isHalted = false;
    clearTimeout(this.retryTimer);
    const socket = new WebSocket(this.wssUrl);
    socket.onopen = () => {
      if (this.isOpening) {
        this.isOpening = false;
        this.socket = socket;
        this.retryCount = 0;
        if (this.onOpen) {
          this.onOpen();
        }
      }
    }
    socket.onclose = () => {
      this.isOpening = false;
      this.socket = null;
      if (this.onClose) {
        this.onClose();
      }
      if (!this.isHalted) {
        const delay = this._retryInterval();
        _logger_js__WEBPACK_IMPORTED_MODULE_0__.default.debug('socket', `Waiting ${delay} after ${this.retryCount} tries`);
        this.retryTimer = setTimeout(() => {
          this.retryCount += 1;
          this.open();
        }, delay);
      }
    }
    socket.onmessage = (message) => {
      if (this.onMessage) {
        this.onMessage(message);
      }
    }
  }

  close() {
    this.isHalted = true;
    this.isOpening = false;
    clearTimeout(this.retryTimer);
    this.retryCount = 0;
    if (this.isOpen()) {
      this.socket.close();
    }
  }

  send(message) {
    if (this.socket && this.socket.readyState === 1) {
      this.socket.send(JSON.stringify(message));
    } else {
      _logger_js__WEBPACK_IMPORTED_MODULE_0__.default.error('socket', 'Error sending', message);
    }
  }
}


/***/ }),

/***/ "webrtc-adapter":
/*!**************************!*\
  !*** external "adapter" ***!
  \**************************/
/***/ ((module) => {

module.exports = adapter;

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
/*!********************************!*\
  !*** ./src/js/client/index.js ***!
  \********************************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var webrtc_adapter__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! webrtc-adapter */ "webrtc-adapter");
/* harmony import */ var webrtc_adapter__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(webrtc_adapter__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _client_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./client.js */ "./src/js/client/client.js");
/*
 *  Copyright (c) 2021 Peter Christensen. All Rights Reserved.
 *  CC BY-NC-ND 4.0.
 */



document.debugLogEnabled = true;
document.infoLogEnabled = true;

if (webrtc_adapter__WEBPACK_IMPORTED_MODULE_0___default().browserDetails.browser.startsWith("Not")) {
  alert("Your browser is not supported.");
} else {
  window.addEventListener('load', function () {
    document.client = new _client_js__WEBPACK_IMPORTED_MODULE_1__.default();
    document.client.open();
  });
  window.addEventListener('beforeunload', function (event) {
    if (document.client && document.client.connected) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
  window.addEventListener('unload', function () {
    document.client.close();
  });
}

})();

/******/ })()
;