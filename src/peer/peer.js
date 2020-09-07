/*
 * Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 * CC BY-NC-ND 4.0.
 */
import Client from '../client.js';
import Connection from '../connection.js';
import View from '../view.js';
import logger from '../logger.js';

class PeersDialog {

  constructor(view) {
    this.header = view.getModalHeader('Peers');
    this.peers = this._peersPanel();
    this.footer = document.createElement('footer')
    this.offers = {};
    this.offersDiv = this.peers.querySelector('#offering-peers');
    this.available = {};
    this.availableDiv = this.peers.querySelector('#available-peers');
  }

  _peersPanel() {
    const section = document.createElement('section');
    const offering = document.createElement('div');
    offering.setAttribute('id', 'offering-peers');
    section.append(offering);
    const available = document.createElement('div');
    available.setAttribute('id', 'available-peers');
    section.append(available);
    return section;
  }

  // Public methods.

  getContent() {
    return [this.header, this.peers, this.footer];
  }

  reset() {
    Object.keys(this.offers).forEach(peerId => {
      this.removeOffer(peerId);
    });
    Object.keys(this.available).forEach(peerId => {
      this.removePeer(peerId);
    });
  }

  addPeer(peerId, offerHandler) {
    if (this.available[peerId]) {
      return;
    }
    if (this.offers[peerId]) {
      this.removeOffer(peerId);
    }
    const peerName = peerId.substr(0, 5);
    const peer = document.createElement('article');
    peer.classList.add('card');
    const section = document.createElement('section');
    peer.append(section);
    const label = document.createElement('label');
    label.textContent = peerName;
    label.classList.add('pseudo', 'button');
    section.append(label);
    const button = document.createElement('button')
    button.textContent = 'Call';
    button.setAttribute('title', `Call ${peerName}`);
    button.style.float = 'right';
    button.addEventListener('click', () => {
      offerHandler(peerId);
    });
    section.append(button);
    logger.info('Adding', peerId);
    this.available[peerId] = peer;
    this.availableDiv.append(peer);
  }

  removePeer(peerId) {
    const peer = this.available[peerId];
    delete this.available[peerId];
    if (peer) {
      logger.info('Removing', peerId);
      peer.remove();
    }
  }

  addOffer(peerId, acceptHandler) {
    if (this.offers[peerId]) {
      return;
    }
    if (this.available[peerId]) {
      this.removePeer(peerId);
    }
    const peerName = peerId.substr(0, 5);
    const peer = document.createElement('article');
    peer.classList.add('card')
    const section = document.createElement('section');
    peer.append(section);
    const label = document.createElement('label');
    label.textContent = peerName;
    label.classList.add('pseudo', 'button');
    section.append(label);
    const button = document.createElement('button')
    button.textContent = 'Answer';
    button.setAttribute('title', `Answer ${peerName}`);
    button.style.float = 'right';
    button.classList.add('success');
    button.addEventListener('click', () => {
      acceptHandler(peerId);
    });
    section.append(button);
    logger.info('Adding offer from', peerId);
    this.offers[peerId] = peer;
    this.offersDiv.append(peer);
  }

  removeOffer(peerId) {
    const peer = this.offers[peerId];
    delete this.offers[peerId];
    if (peer) {
      logger.info('Removing offer from', peerId);
      peer.remove();
    }
  }
}

export default class Peer {

  constructor() {
    this.view = new View();
    this.channelId = location.pathname.split('/').pop();
    this.client = new Client(this.channelId);
    this._setClientHandlers();
    this.connection = null;
    this.peers = new PeersDialog(this.view);
    this.peersButton = this._peersButton();
    this.offlineLabel = this._offlineLabel();
    this.view.setNavMenuContent(this.offlineLabel);
  }

  _offlineLabel() {
    const label = document.createElement('label');
    label.textContent = 'Offline';
    label.classList.add('pseudo', 'button');
    return label;
  }

  _peersButton() {
    const button = document.createElement('button');
    button.textContent = 'Peers';
    button.classList.add('pseudo');
    button.setAttribute('title', 'Show peers list');
    button.addEventListener('click', () => {
      if (!this.connection) {
        this.view.showModal();
      }
    });
    return button;
  }

  _disconnectButton(peerId) {
    const button = document.createElement('button');
    button.textContent = 'Disconnect';
    button.classList.add('pseudo');
    button.setAttribute('title', 'Close the connection');
    button.addEventListener('click', () => {
      this._closeConnection(peerId);
    });
    return button;
  }

  _offerDialog(peerId) {
    const section = document.createElement('section');
    section.textContent = `Offer sent. Waiting for an answer.`;
    const button = document.createElement('button');
    button.textContent = 'Cancel';
    button.setAttribute('title', 'Cancel the offer');
    button.style.float = 'right';
    button.addEventListener('click', () => {
      this._closeConnection(peerId);
      this.view.setModalContent(...this.peers.getContent());
      this.view.showModal();
    });
    const footer = document.createElement('footer');
    footer.append(button);
    return [section, footer];
  }

  _setClientHandlers() {
    this.client.setConnectHandlers(
      this._connectHandler.bind(this),
      this._disconnectHandler.bind(this)
    );
    this.client.setLoginHandlers(
      this._loginSuccessHandler.bind(this),
      this._loginFailureHandler.bind(this),
      this._clientReadyHandler.bind(this)
    )
    this.client.setMessageHandlers(
      this._presenceEventHandler.bind(this),
      this._peerMessageHandler.bind(this),
      this._puntHandler.bind(this)
    );
  }

  connect() {
    this.client.connect();
  }

  disconnect() {
    this.view.stopVideo();
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }
    if (this.client.isConnected()) {
      this.client.disconnect();
    }
  }

  // Connection handlers.

  _offerConnection(peerId) {
    const onSuccess = () => {
      this.client.publishPresence(false);
      this.client.sendInfoMsg(this.connection.peerId, 'offer');
      this.view.setModalContent(...this._offerDialog(peerId));
      this.view.showModal(true);
    };
    const onError = (error) => {
      logger.error(error);
      this._closeConnection(peerId);
      this.view.showAlert(error.message);
    };
    if (!this.connection) {
      this.view.hideModal();
      this.connection = new Connection(true);
      this.connection.peerId = peerId;
      this.connection.initUserMedia(onSuccess, onError, true, true);
    }
  }

  _acceptConnection(peerId) {
    const onSuccess = () => {
      this.client.publishPresence(false);
      this.client.sendInfoMsg(this.connection.peerId, 'accept');
      this._openConnection(peerId);
    };
    const onError = (error) => {
      logger.error(error);
      this._closeConnection(peerId);
      this.view.showAlert(error.message);
    };
    if (!this.connection) {
      this.view.hideModal();
      this.peers.removeOffer(peerId);
      this.connection = new Connection(false);
      this.connection.peerId = peerId;
      this.connection.initUserMedia(
        onSuccess, onError, true, {facingMode: 'user'}
      );
    }
  }

  _openConnection(peerId) {
    const trackHandler = (track) => {
      this.view.addTrack(track);
      logger.info('Added remote', track.kind);
    };
    const candidateHandler = (jsonCandidate) => {
      const stringCandidate = JSON.stringify(jsonCandidate);
      this.client.sendInfoMsg(this.connection.peerId, stringCandidate);
      logger.info('Sent candidate');
    };
    const failureHandler = () => {
      this._closeConnection(peerId);
      this.view.showAlert('Connection failed.');
    };
    const offerHandler = (jsonSdp) => {
      const stringSdp = JSON.stringify(jsonSdp);
      this.client.sendInfoMsg(this.connection.peerId, stringSdp);
      logger.info('Sent description');
    };
    if (this.connection && this.connection.peerId === peerId) {
      this.view.hideModal();
      this.view.setNavMenuContent(this._disconnectButton(peerId));
      this.view.startVideo();
      this.connection.init(
        trackHandler,
        candidateHandler,
        failureHandler,
        offerHandler
      );
      this.connection.addTracks();
    }
  }

  _closeConnection(peerId) {
    this.view.setModalContent(...this.peers.getContent());
    this.view.setNavMenuContent(this.peersButton);
    this.view.stopVideo();
    this.client.sendInfoMsg(peerId, 'close');
    this.client.publishPresence(true);
    if (this.connection && this.connection.peerId === peerId) {
      this.connection.close();
      this.connection = null;
    }
    this.view.showModal();
  }

  // Client connect/login handlers.

  _connectHandler() {
    logger.info('Connected');
    this.view.setNavMenuContent(this.peersButton);
    if (!this.connection) {
      this.view.setModalContent(...this.peers.getContent());
      this.view.showModal();
    }
  }

  _disconnectHandler() {
    logger.info('Disconnected');
    this.peers.reset();
    this.view.setNavMenuContent(this.offlineLabel);
    this.view.hideModal();
  }

  _loginSuccessHandler() {
    logger.info('Logged in');
  }

  _loginFailureHandler(message) {
    logger.error(message);
    this.view.showAlert(`Login failed. ${message}.`);
  }

  _clientReadyHandler(clientId) {
    this.view.setNavStatus(clientId.substr(0, 5));
  }

  // Client message handlers.

  _presenceEventHandler(peerId, isAvailable) {
    if (isAvailable) {
      this.peers.addPeer(peerId, this._offerConnection.bind(this));
      if (!this.connection) {
        this.client.sendInfoMsg(peerId, 'available');
      }
    } else {
      this.peers.removePeer(peerId);
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

  _puntHandler() {
    logger.info('Punted');
    this.view.hideModal();
    this.view.showAlert(
      'Offline. '
      + 'You\'re logged in from another tab '
      + 'or the channel is full.'
    );
  }

  // Specific peer message handlers.

  _handleOffer(peerId) {
    this.peers.addOffer(peerId, this._acceptConnection.bind(this));
    if (!this.connection && !this.view.isModalVisible()) {
      this.view.showModal();
    }
  }

  _handleAccept(peerId) {
    this._openConnection(peerId);
  }

  _handleClose(peerId) {
    if (this.connection && this.connection.peerId === peerId) {
      this._closeConnection(peerId);
    } else {
      this.peers.removeOffer(peerId);
    }
  }

  _handlePresenceInfo(peerId, isAvailable) {
    if (isAvailable) {
      this.peers.addPeer(peerId, this._offerConnection.bind(this));
    } else {
      this.peers.removePeer(peerId);
    }
  }

  _handleCandidate(peerId, jsonCandidate) {
    if (this.connection && this.connection.peerId === peerId) {
      logger.info('Received candidate');
      this.connection.addCandidate(jsonCandidate).then(() => {
      }).catch(error => {
        logger.error(error);
      });
    }
  }

  _handleSdp(peerId, jsonSdp) {
    if (this.connection && this.connection.peerId === peerId) {
      logger.debug('Received SDP');
      const sdpHandler = (newJsonSdp) => {
        const stringSdp = JSON.stringify(newJsonSdp);
        this.client.sendInfoMsg(peerId, stringSdp);
        logger.info('Sent SDP');
      };
      this.connection.addSdp(jsonSdp, sdpHandler).then(() => {
      }).catch(error => {
        logger.error(error);
      });
    }
  }
}
