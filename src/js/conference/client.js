/*
 * Copyright (c) 2021 Peter Christensen. All Rights Reserved.
 * CC BY-NC-ND 4.0.
 */
import logger from '../logger.js';
import LocalMedia from '../local-media.js';
import VertoClient from '../verto/client.js';
import VertoPeer from '../verto/peer.js';

export default class ConferenceClient {

  constructor() {
    this.client = new VertoClient();
    this.client.getSessionData = this._getSessionData.bind(this);
    this.client.onLogin = this._startMedia.bind(this);
    this.client.onEvent = this._onEvent.bind(this);

    this.localMedia = new LocalMedia();
    this.localMedia.onStart = this._onMediaStart.bind(this);

    this.peer = new VertoPeer();
    this.peer.onBundleReady = this._onPeerReady.bind(this);
    this.peer.onRemoteTrack = this._onPeerTrack.bind(this);

    this.callID = this.client.newUuid();
    this.remoteSdp = null;
  }

  open() {
    this.client.open();
  }

  close() {
    this.peer.close();
    this.localMedia.stop();
    this.client.close();
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
      onError(error);
    });
  }

  _startMedia() {
    this.localMedia.start();
  }

  _onEvent(event) {
    if (event.method === 'verto.answer') {
      if (this.remoteSdp) {
        this.peer.setRemoteDescription('answer', this.remoteSdp);
        this.remoteSdp = null;
      }
    } else if (event.method === 'verto.attach') {
      this.callID = event.params.callID;
      this.peer.setRemoteDescription('offer', event.params.sdp);
    } else if (event.method === 'verto.clientReady') {
      logger.info('conference', 'Client ready');
    } else if (event.method === 'verto.media') {
      this.remoteSdp = event.params.sdp;
    } else {
      logger.error('conference', 'Unhandled event', event)
    }
  }

  // Local media callbacks

  _onMediaStart(stream) {
    this.peer.connect(false);
    this.peer.addTracks(stream);
  }

  // Verto peer callbacks

  _onPeerReady(sdpData) {
    const onSuccess = (message) => {
      logger.info('conference', message.result.callID);
    }
    const onError = (error) => {
      logger.error('conference', 'Invite failed', error);
    }
    const dest = this.client.channelId;
    logger.debug('client', 'Invite', dest);
    this.client.sendRequest('verto.invite', {
      sdp: sdpData,
      dialogParams: {
        callID: this.callID,
        destination_number: dest,
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
    logger.info('conference', 'Add this track to the video element!', track);
  }
}
