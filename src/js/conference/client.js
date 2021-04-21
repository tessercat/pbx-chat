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

    this.localMedia = new LocalMedia();
    this.localMedia.onStart = this._onMediaStart.bind(this);

    this.peer = new VertoPeer();
    this.peer.onBundleReady = this._onPeerReady.bind(this);
    this.peer.onRemoteTrack = this._onPeerTrack.bind(this);
  }

  open() {
    this.client.open();
  }

  close() {
    this.peer.close();
    this.localMedia.stop();
    this.client.close();
  }

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

  // Local media callbacks

  _startMedia() {
    this.localMedia.start();
  }

  _onMediaStart(stream) {
    this.peer.connect(false);
    this.peer.addTracks(stream);
  }

  // RTC peer callbacks

  _onPeerReady(sdpData) {
    const onSuccess = (message) => {
      const callID = message.result.callID;
      logger.info('conference', callID);
    }
    this.client.sendInvite(this.client.channelId, sdpData, onSuccess);
  }

  _onPeerTrack(track) {
    logger.info('conference', track);
  }
}
