/*
 * Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 * CC BY-NC-ND 4.0.
 */
import Client from './client.js';
import PeerConnection from './peer-connection.js';
import UserMedia from './user-media.js';
import View from './view.js';
import logger from './logger.js';

export default class Peer {

  constructor() {
    this.view = new View();
    this.userMedia = new UserMedia();
    this.peerConnection = null;
  }

  // Public methods.

  connect() {
    this.client = new Client(this.view.clientId);
    this.client.setMessageHandlers(
      this._presenceEventHandler.bind(this),
      this._peerMessageHandler.bind(this)
    );
    this.client.connect(
      this.view.clientId,
      this.view.password,
      this.view.channelId,
    );
  }

  disconnect() {
    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
    }
    if (this.userMedia) {
      this.userMedia.destroy();
    }
  }

  // Peer-to-peer calling view callback handlers.

  _offerPeerConnection(peerId) {
    if (!this.peerConnection) {
      const onSuccess = () => {
        this.client.sendInfoMsg(this.peerConnection.peerId, 'offer');
        this.view.showCallingDialog(
          peerId, this._closePeerConnection.bind(this)
        );
      };
      const onError = (error) => {
        this.view.showErrorDialog(error);
      };
      this.peerConnection = new PeerConnection(peerId, true);
      this.userMedia.init(onSuccess, onError);
    }
  }

  _acceptPeerConnection(peerId) {
    if (!this.peerConnection) {
      const onSuccess = () => {
        this.client.sendInfoMsg(this.peerConnection.peerId, 'accept');
        this._initPeerConnection();
      };
      const onError = (error) => {
        throw error;
      };
      this.peerConnection = new PeerConnection(peerId, false);
      this.userMedia.init(onSuccess, onError);
    }
  }

  _closePeerConnection() {
    if (this.peerConnection) {
      this.client.sendInfoMsg(this.peerConnection.peerId, 'close');
      this.view.removeTracks();
      this.peerConnection.destroy();
      this.peerConnection = null;
    }
  }

  // Peer-to-peer calling protocol message handlers.

  _presenceEventHandler(peerId, isAvailable) {
    if (isAvailable === null) {
      this.view.removePeer(peerId);
    } else {
      if (!this.view.hasPeer(peerId)) {
        this.view.addPeer(peerId, this._offerPeerConnection.bind(this));
      }
      this.view.setPeerStatus(peerId, isAvailable);
      if (isAvailable) {
        this.client.sendInfoMsg(peerId, "available");
      } else {
        this.client.sendInfoMsg(peerId, "unavailable");
      }
    }
  }

  _peerMessageHandler(peerId, message) {
    if (message === 'offer') {
      this._handleOffer(peerId);
    } else if (message === 'accept') {
      this._handleAccept(peerId);
    } else if (message === 'close') {
      this._handleClose(peerId);
    } else if (message === 'available') {
      this._handlePresenceInfo(peerId, true);
    } else if (message === 'unavailable') {
      this._handlePresenceInfo(peerId, false);
    } else {
      let jsonData;
      try {
        jsonData = JSON.parse(message);
      } catch (error) {
        logger.error('Received unhandled message', peerId, message);
        return;
      }
      if ('candidate' in jsonData) {
        this._handleCandidate(peerId, jsonData);
      } else if ('sdp' in jsonData) {
        this._handleSdp(peerId, jsonData);
      } else {
        logger.error('Received unhandled JSON message', peerId, jsonData);
      }
    }
  }

  _initPeerConnection() {
    const trackHandler = (track) => {
      this.view.addTrack(track);
      logger.info('Added local', track.kind);
    }
    const candidateHandler = (jsonCandidate) => {
      const stringCandidate = JSON.stringify(jsonCandidate);
      this.client.sendInfoMsg(this.peerConnection.peerId, stringCandidate);
      logger.info('Sent candidate');
    }
    const offerHandler = (jsonSdp) => {
      const stringSdp = JSON.stringify(jsonSdp);
      this.client.sendInfoMsg(this.peerConnection.peerId, stringSdp);
      logger.info('Sent description');
    }
    this.peerConnection.init(
      trackHandler, candidateHandler, offerHandler
    );
    this.peerConnection.addUserMedia(this.userMedia.stream);
  }

  _handleOffer(peerId) {
    if (this.peerConnection) {
      if (this.peerConnection.peerId !== peerId) {
        this.client.sendInfoMsg(peerId, 'close');
      }
    } else {
      this.view.showAnswerDialog(
        peerId,
        this._acceptPeerConnection.bind(this),
        this._closePeerConnection.bind(this)
      );
    }
  }

  _handleAccept(peerId) {
    if (this.peerConnection && this.peerConnection.peerId === peerId) {
      this._initPeerConnection();
    }
  }

  _handleClose(peerId) {
    if (this.peerConnection && this.peerConnection.peerId === peerId) {
      this.view.removeTracks();
      this.peerConnection.destroy();
      this.peerConnection = null;
    }
  }

  _handlePresenceInfo(peerId, isAvailable) {
    if (isAvailable === null) {
      this.view.removePeer(peerId);
    } else {
      if (!this.view.hasPeer(peerId)) {
        this.view.addPeer(peerId, this._offerPeerConnection.bind(this));
      }
      this.view.setPeerStatus(peerId, isAvailable);
    }
  }

  _handleCandidate(peerId, jsonCandidate) {
    if (this.peerConnection && this.peerConnection.peerId === peerId) {
      logger.info('Received candidate');
      this.peerConnection.addCandidate(jsonCandidate).then(() => {
      }).catch(error => {
        throw error;
      });
    }
  }

  _handleSdp(peerId, jsonSdp) {
    if (this.peerConnection && this.peerConnection.peerId === peerId) {
      logger.debug('Received SDP');
      const sdpHandler = (newJsonSdp) => {
        const stringSdp = JSON.stringify(newJsonSdp);
        this.sendInfoMsg(peerId, stringSdp);
        logger.info('Sent SDP');
      }
      this.peerConnection.addSdp(jsonSdp, sdpHandler).then(() => {
      }).catch(error => {
        throw error;
      });
    }
  }
}
