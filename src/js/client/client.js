/*
 * Copyright (c) 2021 Peter Christensen. All Rights Reserved.
 * CC BY-NC-ND 4.0.
 */
import logger from '../logger.js';
import LocalMedia from '../local-media.js';
import VertoClient from '../verto/client.js';
import VertoPeer from '../verto/peer.js';

export default class VertoActionClient {

  constructor() {

    const wssUrl = `wss://${location.host}/verto`
    this.channelId = location.pathname.split('/').pop();
    this.client = new VertoClient(wssUrl, this.channelId);
    this.client.getSessionData = this._getSessionData.bind(this);
    this.client.onEvent = this._onEvent.bind(this);
    this.client.onLoginError = this.close.bind(this);

    this.audio = document.getElementById('audio');
    this.video = document.getElementById('video');

    this.localMedia = new LocalMedia();
    this.localMedia.onStart = this._onMediaStart.bind(this);

    const stunPort = document.getElementById('stun-port').value
    const stunUrl = `stun:${location.host}:${stunPort}`
    this.peer = new VertoPeer(stunUrl, false);
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
      logger.info('channel', 'Client ready');
      this.peer.init();
      this.peer.addTracks(this.localMedia.stream);
      if (this.remoteSdp) {
        this.peer.setRemoteDescription('offer', this.remoteSdp);
        this.remoteSdp = null;
      }
    } else if (event.method === 'verto.media') {
      this.remoteSdp = event.params.sdp;
    } else {
      logger.error('channel', 'Unhandled event', event)
    }
  }

  // Local media callbacks

  _onMediaStart() {
    this.client.open();
  }

  // Verto peer callbacks

  _onBundleReady(sdpData) {
    const onSuccess = (message) => {
      logger.info('channel', 'Bundle sent', message.result);
    }
    const onError = (error) => {
      logger.error('channel', 'Invite failed', error);
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
    logger.info('channel', 'Adding track', track);
    if (!this.audio.srcObject) {
      this.audio.srcObject = new MediaStream();
    }
    this.audio.srcObject.addTrack(track);
    //this.audio.style.display = 'unset';
  }
}
