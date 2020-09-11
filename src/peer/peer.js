/*
 * Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 * CC BY-NC-ND 4.0.
 */
import Client from '../client.js';
import Connection from '../connection.js';
import View from '../view.js';
import logger from '../logger.js';

class PeersPanel {

  constructor() {
    this.panel = this._panel();
    this.statusMsg = this._statusMsg();
    this.setOffline();
    this.panel.append(this.statusMsg);
    this.peers = {};
  }

  _panel() {
    const div = document.createElement('div');
    div.style.marginLeft = 'auto';
    div.style.marginRight = 'auto';
    div.style.maxWidth = '600px'
    div.style.padding = '1em';
    const mm = matchMedia('(min-width: 600px)');
    mm.addListener((mm) => {
      if (mm.matches) {
        div.style.maxWidth = '600px'
      } else {
        div.style.maxWidth = '100%';
      }
    });
    return div;
  }

  _statusMsg() {
    const p = document.createElement('p');
    p.style.textAlign = 'center';
    return p;
  }

  setOnline() {
    this.statusMsg.innerHTML = 'Waiting for peers';
  }

  setOffline() {
    this.statusMsg.innerHTML = 'Offline';
  }

  getContent() {
    return [this.panel];
  }

  addPeer(peerId, offerHandler) {
    if (this.peers[peerId]) {
      return;
    }
    if (Object.keys(this.peers).length === 0) {
      this.statusMsg.remove();
    }
    const peerName = peerId.substr(0, 5);
    const article = document.createElement('article');
    article.classList.add('card');
    const section = document.createElement('section');
    section.style.padding = '0.5em';
    article.append(section);
    const label = document.createElement('label');
    label.textContent = peerName;
    label.classList.add('pseudo', 'button');
    section.append(label);
    const offerButton = document.createElement('button')
    offerButton.textContent = 'Call';
    offerButton.setAttribute('title', `Call ${peerName}`);
    offerButton.style.float = 'right';
    offerButton.addEventListener('click', () => {
      offerHandler(peerId);
    });
    section.append(offerButton);
    logger.info('Adding', peerId);
    this.peers[peerId] = article;
    this.panel.append(article);
  }

  removePeer(peerId) {
    const peer = this.peers[peerId];
    delete this.peers[peerId];
    if (peer) {
      logger.info('Removing', peerId);
      peer.remove();
    }
    if (Object.keys(this.peers).length === 0) {
      this.panel.append(this.statusMsg);
    }
  }

  reset() {
    Object.keys(this.peers).forEach(peerId => {
      this.removePeer(peerId);
    });
  }
}

class OffersDialog {

  constructor(view) {
    this.header = view.getModalHeader('Offers');
    this.panel = document.createElement('section');
    this.footer = this._footer(view);
    this.offers = {};
  }

  _footer(view) {
    const ignoreButton = document.createElement('button');
    ignoreButton.textContent = 'Ignore';
    ignoreButton.setAttribute('title', 'Ignore all current offers');
    ignoreButton.style.float = 'right';
    ignoreButton.addEventListener('click', () => {
      view.hideModal();
      this.reset();
    });
    const footer = document.createElement('footer');
    footer.append(ignoreButton);
    return footer;
  }

  getContent() {
    return [this.header, this.panel, this.footer];
  }

  hasContent() {
    return Object.keys(this.offers).length > 0;
  }

  addOffer(peerId, acceptHandler) {
    if (this.offers[peerId]) {
      return;
    }
    const peerName = peerId.substr(0, 5);
    const article = document.createElement('article');
    article.classList.add('card')
    const section = document.createElement('section');
    section.style.padding = '0.5em';
    article.append(section);
    const label = document.createElement('label');
    label.textContent = peerName;
    label.classList.add('pseudo', 'button');
    section.append(label);
    const acceptButton = document.createElement('button')
    acceptButton.textContent = 'Answer';
    acceptButton.setAttribute('title', `Answer ${peerName}`);
    acceptButton.style.float = 'right';
    acceptButton.classList.add('success');
    acceptButton.addEventListener('click', () => {
      acceptHandler(peerId);
    });
    section.append(acceptButton);
    logger.info('Adding offer from', peerId);
    this.offers[peerId] = article;
    this.panel.append(article);
  }

  removeOffer(peerId) {
    const peer = this.offers[peerId];
    delete this.offers[peerId];
    if (peer) {
      logger.info('Removing offer from', peerId);
      peer.remove();
    }
  }

  reset() {
    Object.keys(this.offers).forEach(peerId => {
      this.removeOffer(peerId);
    });
  }
}

class OfferingDialog {

  constructor(closeHandler) {
    this.section = document.createElement('section');
    this.footer = this._footer(closeHandler);
    this.peerId = null;
  }

  _footer(cancelHandler) {
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.setAttribute('title', 'Cancel the offer');
    cancelButton.style.float = 'right';
    cancelButton.addEventListener('click', () => {
      cancelHandler(this.peerId);
      this.peerId = null;
    });
    const footer = document.createElement('footer');
    footer.append(cancelButton);
    return footer;
  }

  setInitializing(peerId) {
    this.peerId = peerId;
    this.section.textContent = 'Starting local media.';
  }

  setOffering() {
    this.section.textContent = 'Offer sent. Waiting for an answer.';
  }

  getContent() {
    return [this.section, this.footer];
  }
}

export default class Peer {

  constructor() {
    this.view = new View();
    this.channelId = location.pathname.split('/').pop();
    this.client = new Client(this.channelId);
    this._setClientHandlers();
    this.connection = new Connection();
    this.peersPanel = new PeersPanel();
    this.view.setChannelInfoContent(...this.peersPanel.getContent());
    this.offersDialog = new OffersDialog(this.view);
    this.offeringDialog = new OfferingDialog(this._cancelOffer.bind(this));
    this.onlineLabel = this._onlineLabel();
    this.offlineLabel = this._offlineLabel();
    this.view.setNavMenuContent(this.offlineLabel);
  }

  connect() {
    this.client.connect();
  }

  disconnect() {
    this.view.hideModal();
    this.view.hidePlayer();
    this.connection.close();
    this.client.disconnect();
  }

  // Element builders.

  _offlineLabel() {
    const label = document.createElement('label');
    label.textContent = 'Offline';
    label.classList.add('pseudo', 'button');
    return label;
  }

  _onlineLabel() {
    const label = document.createElement('label');
    label.textContent = 'Online';
    label.classList.add('pseudo', 'button');
    return label;
  }

  _disconnectButton(peerId) {
    const button = document.createElement('button');
    button.textContent = 'Disconnect';
    button.classList.add('pseudo', 'button');
    button.setAttribute('title', 'Close the connection');
    button.addEventListener('click', () => {
      this._closeConnection(peerId);
      this.client.sendInfoMsg(peerId, 'close');
      this.client.publishPresence(true);
    });
    return button;
  }

  // Peer-to-peer connection handlers.

  hasConnectedPeer(peerId = null) {
    if (peerId) {
      return this.connection.clientId && this.connection.clientId === peerId;
    }
    return this.connection.clientId;
  }

  _offerConnection(peerId) {
    const onSuccess = () => {
      this.client.sendInfoMsg(peerId, 'offer');
      this.client.publishPresence(false);
      this.offeringDialog.setOffering();
    };
    const onError = (error) => {
      logger.info('Failed to offer connection to', peerId, error);
      this.view.showAlert(error.message);
      this.connection.close();
      this.client.publishPresence(true);
    };
    if (!this.hasConnectedPeer()) {
      logger.info('Offering connection to', peerId);
      this.connection.init(peerId, true, location.hostname);
      this.offeringDialog.setInitializing(peerId);
      this.view.showModal(this.offeringDialog);
      this.connection.initUserMedia(onSuccess, onError, true, true);
    }
  }

  _cancelOffer(peerId) {
    logger.info('Canceling offer to', peerId);
    this.view.hideModal();
    this.connection.close();
    this.client.sendInfoMsg(peerId, 'close');
    this.client.publishPresence(true);
  }

  _acceptConnection(peerId) {
    const onSuccess = () => {
      this.client.sendInfoMsg(peerId, 'accept');
      this.client.publishPresence(false);
      this._openConnection(peerId);
    };
    const onError = (error) => {
      logger.error('Error accepting offer from', peerId, error);
      this.client.sendInfoMsg(peerId, 'fail');
      this.view.showAlert(error.message);
      this.view.hidePlayer();
      this.connection.close();
    };
    if (!this.hasConnectedPeer()) {
      logger.info('Accepting offer from', peerId);
      this.view.showPlayer();
      this.view.hideModal();
      this.offersDialog.removeOffer(peerId);
      this.connection.init(peerId, false, location.hostname);
      this.connection.initUserMedia(onSuccess, onError, true, true);
    }
  }

  _openConnection(peerId) {
    if (this.hasConnectedPeer(peerId)) {
      const trackHandler = (track) => {
        this.view.addTrack(track);
        logger.info('Added remote', track.kind);
      };
      const candidateHandler = (jsonCandidate) => {
        const stringCandidate = JSON.stringify(jsonCandidate);
        this.client.sendInfoMsg(peerId, stringCandidate, false);
        logger.info('Sent candidate');
      };
      const offerHandler = (jsonSdp) => {
        const stringSdp = JSON.stringify(jsonSdp);
        this.client.sendInfoMsg(peerId, stringSdp, false);
        logger.info('Sent SDP');
      };
      const iceHandler = () => {
        logger.error('ICE failed connecting to', peerId);
        this.client.sendInfoMsg(peerId, 'fail');
        this.view.hidePlayer();
        this.connection.close();
        this.view.showAlert('ICE failed.');
        this.view.setNavMenuContent(this.onlineLabel);
        this.client.publishPresence(true);
      };
      logger.info('Opening connection to', peerId);
      this.view.setNavMenuContent(this._disconnectButton(peerId));
      this.connection.open(
        trackHandler, candidateHandler, offerHandler, iceHandler
      );
    }
  }

  _closeConnection(peerId) {
    logger.info('Closing connection to', peerId);
    this.view.hidePlayer();
    this.connection.close();
    this.view.setNavMenuContent(this.onlineLabel);
  }

  // Client connect/login/message handlers.

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

  _connectHandler() {
    logger.info('Connected');
    this.peersPanel.setOnline();
    this.view.setNavMenuContent(this.onlineLabel);
  }

  _disconnectHandler(pingTimeout) {
    logger.info('Disconnected');
    this.peersPanel.setOffline();
    this.peersPanel.reset();
    this.view.setNavMenuContent(this.offlineLabel);
    this.view.hideModal();
    if (pingTimeout) {
      this.view.showAlert(
        'Offline. '
        + 'The connection timed out. '
        + 'Reload to reconnect.'
      );
    }
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

  _presenceEventHandler(peerId, isAvailable) {
    if (isAvailable) {
      this.peersPanel.addPeer(peerId, this._offerConnection.bind(this));
      if (!this.hasConnectedPeer()) {
        this.client.sendInfoMsg(peerId, 'available');
      }
    } else {
      this.peersPanel.removePeer(peerId);
    }
  }

  _peerMessageHandler(peerId, message) {
    if (message === 'offer') {
      this._handleOffer(peerId);
    } else if (message === 'accept') {
      this._handleAccept(peerId);
    } else if (message === 'close') {
      this._handleClose(peerId);
    } else if (message === 'fail') {
      this._handleFail(peerId);
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
    this.view.showAlert(
      'Offline. '
      + 'You\'re logged in from another tab '
      + 'or the channel is full.'
    );
  }

  // Specific peer message handlers.

  _handleOffer(peerId) {
    this.offersDialog.addOffer(peerId, this._acceptConnection.bind(this));
    if (!this.hasConnectedPeer()) {
      this.view.showModal(this.offersDialog);
    }
  }

  _handleAccept(peerId) {
    this.view.hideModal();
    this.view.showPlayer();
    this._openConnection(peerId);
  }

  _handleClose(peerId) {
    if (this.hasConnectedPeer(peerId)) {
      this._closeConnection(peerId);
      this.client.publishPresence(true);
    } else {
      this.offersDialog.removeOffer(peerId);
      if (!this.offersDialog.hasContent()) {
        this.view.hideModal();
      }
    }
  }

  _handleFail(peerId) {
    if (this.hasConnectedPeer(peerId)) {
      logger.error('Received fail from', peerId);
      this.view.showAlert('The other peer failed to connect.');
      this._closeConnection(peerId);
      this.client.publishPresence(true);
    }
  }

  _handlePresenceInfo(peerId, isAvailable) {
    if (isAvailable) {
      this.peersPanel.addPeer(peerId, this._offerConnection.bind(this));
    } else {
      this.peersPanel.removePeer(peerId);
    }
  }

  _handleCandidate(peerId, jsonCandidate) {
    if (this.hasConnectedPeer(peerId)) {
      logger.info('Received candidate');
      const iceHandler = () => {
        logger.error('ICE failed connecting to', peerId);
        this.view.showAlert('ICE failed.');
        this._closeConnection(peerId, true);
        this.client.sendInfoMsg(peerId, 'fail');
        this.client.publishPresence(true);
      };
      this.connection.addCandidate(jsonCandidate, iceHandler).then(() => {
      }).catch(error => {
        logger.error(error);
      });
    }
  }

  _handleSdp(peerId, jsonSdp) {
    if (this.hasConnectedPeer(peerId)) {
      logger.debug('Received SDP');
      const sdpHandler = (newJsonSdp) => {
        const stringSdp = JSON.stringify(newJsonSdp);
        this.client.sendInfoMsg(peerId, stringSdp, false);
        logger.info('Sent SDP');
      };
      this.connection.addSdp(jsonSdp, sdpHandler).then(() => {
      }).catch(error => {
        logger.error(error);
      });
    }
  }
}
