/*
 * Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 * CC BY-NC-ND 4.0.
 */
import Client from '../client.js';
import Connection from '../connection.js';
import PeersPanel from './peers-panel.js';
import OffersDialog from './offers-dialog.js';
import OfferDialog from './offer-dialog.js';
import View from '../view.js';
import logger from '../logger.js';

const STATUS = {
  ready: 'ready',
  available: 'available',
  unavailable: 'unavailable',
  gone: 'gone'
}

const MESSAGES = {
  offer: 'offer',
  accept: 'accept',
  close: 'close',
  error: 'error'
}

export default class Peer {

  constructor() {
    this.view = new View();
    this.client = new Client();
    this._setHandlers();
    this.connection = new Connection();
    this.peersPanel = new PeersPanel();
    this.view.setChannelInfoContent(...this.peersPanel.getContent());
    this.offersDialog = new OffersDialog(this.view);
    this.offerDialog = new OfferDialog(this._cancelOffer.bind(this));
    this.onlineLabel = this._onlineLabel();
    this.offlineLabel = this._offlineLabel();
    this.view.setNavMenuContent(this.offlineLabel);
  }

  connect() {
    this.client.connect();
  }

  disconnect() {
    this.client.disconnect();
  }

  // Nav menu button builders.

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
      logger.info('Closing connection');
      this._closeConnection();
      this.client.sendInfoMsg(peerId, {peerAction: MESSAGES.close});
      this.client.publish({peerStatus: STATUS.available});
      if (this.offersDialog.hasContent()) {
        this.view.showModal(this.offersDialog);
      }
    });
    return button;
  }

  // Button event connection negotiation handlers.

  _offerConnection(peerId) {
    const onSuccess = () => {
      this.client.sendInfoMsg(peerId, {peerAction: MESSAGES.offer});
      this.client.publish({peerStatus: STATUS.unavailable});
      this.offerDialog.setOffering(peerId);
    };
    const onError = (error) => {
      logger.info('Error offering connection', error.message);
      this.offerDialog.setClosed();
      this.view.showAlert(error.message);
      this.view.showModal(this.offersDialog);
      this.connection.close();
    };
    if (this.connection.isIdle()) {
      logger.info('Offering connection', peerId);
      this.connection.init(peerId, true, location.hostname);
      this.offerDialog.setInitializing();
      this.view.showModal(this.offerDialog);
      this.connection.initUserMedia(onSuccess, onError, true, true);
    }
  }

  _cancelOffer() {
    if (this.offerDialog.isOffering()) {
      logger.info('Canceling offer');
      this.client.sendInfoMsg(
        this.offerDialog.offerId, {peerAction: MESSAGES.close}
      );
    }
    this.offerDialog.setClosed();
    this.view.hideModal(this.offerDialog);
    this.connection.close();
    this.client.publish({peerStatus: STATUS.available});
    if (this.offersDialog.hasContent()) {
      this.view.showModal(this.offersDialog);
    }
  }

  _ignoreOffer(peerId) {
    this.offersDialog.removeOffer(peerId);
    this.offersDialog.ignoreOffer(peerId);
    if (!this.offersDialog.hasContent()) {
      this.view.hideModal(this.offersDialog);
    }
  }

  _acceptOffer(peerId) {
    const onSuccess = () => {
      this.client.sendInfoMsg(peerId, {peerAction: MESSAGES.accept});
      this.client.publish({peerStatus: STATUS.unavailable});
      this._openConnection(peerId);
      this.offersDialog.removeOffer(peerId);
    };
    const onError = (error) => {
      logger.info('Error accepting offer', peerId, error.message);
      this.client.sendInfoMsg(peerId, {peerAction: MESSAGES.error});
      this.view.showAlert(error.message);
      this.view.showModal(this.offersDialog);
      this.view.hidePlayer();
      this.connection.close();
      this.offersDialog.removeOffer(peerId);
    };
    if (this.connection.isIdle()) {
      logger.info('Accepted offer', peerId);
      this.view.showPlayer();
      this.view.hideModal(this.offersDialog);
      this.connection.init(peerId, false, location.hostname);
      this.connection.initUserMedia(onSuccess, onError, true, true);
    }
  }

  // Button and message event connection negotiation handers.

  _openConnection(peerId) {
    if (this.connection.isConnectedTo(peerId)) {
      const trackHandler = (track) => {
        this.view.addTrack(track);
      };
      const candidateHandler = (candidate) => {
        this.client.sendInfoMsg(peerId, candidate);
        logger.info('Sent candidate');
      };
      const offerHandler = (sdp) => {
        this.client.sendInfoMsg(peerId, sdp);
        logger.info('Sent SDP');
      };
      const iceHandler = () => {
        this.client.sendInfoMsg(peerId, {peerAction: MESSAGES.error});
        this.view.hidePlayer();
        this.connection.close();
        this.view.showAlert('ICE failed. Can\'t connect.');
        this.view.showModal(this.offersDialog);
        this.client.publish({peerStatus: STATUS.available});
      };
      this.view.setNavMenuContent(this._disconnectButton(peerId));
      this.connection.open(
        trackHandler, candidateHandler, offerHandler, iceHandler
      );
    }
  }

  _closeConnection() {
    this.view.hidePlayer();
    this.connection.close();
    this.view.setNavMenuContent(this.onlineLabel);
  }

  // Client join/login/message handlers.

  _setHandlers() {
    this.client.setSocketHandlers(
      this._connectHandler.bind(this),
      this._disconnectHandler.bind(this)
    );
    this.client.setSessionHandlers(
      null, this._loginErrorHandler.bind(this),
      this._readyHandler.bind(this),
      this._pingHandler.bind(this), null
    )
    this.client.setMessageHandlers(
      this._eventHandler.bind(this),
      this._messageHandler.bind(this),
      this._puntHandler.bind(this)
    );
  }

  _connectHandler() {
    this.peersPanel.setOnline();
    this.view.setNavMenuContent(this.onlineLabel);
  }

  _disconnectHandler(isTimeout) {
    if (this.client.isConnected()) {
      this.client.publish({peerStatus: STATUS.gone});
    } else {
      this.view.setNavMenuContent(this.offlineLabel);
      this.peersPanel.setOffline();
      this.peersPanel.reset();
      this.offersDialog.reset();
      this.view.hideModal(this.offersDialog);
      if (this.offerDialog.isOffering()) {
        this.offerDialog.setClosed('You left the channel.');
      } else if (isTimeout) {
        this.view.showAlert(
          'Offline. '
          + 'The connection timed out. '
          + 'Reload to re-join the channel.'
        );
      }
    }
  }

  _loginErrorHandler(message) {
    this.view.showAlert(`Login failed. ${message}.`);
  }

  _readyHandler() {
    const onSuccess = () => {
      this.client.publish({peerStatus: STATUS.ready});
    };
    const onError = () => {
      this.view.showAlert('Subscription error');
    }
    this.view.setNavStatus(this.client.clientId.substr(0, 5));
    this.client.subscribe(onSuccess, onError);
  }

  _pingHandler() {
    if (this.offerDialog.isOffering()) {
      this.client.sendInfoMsg(
        this.offerDialog.offerId, {peerAction: MESSAGES.offer}
      );
    }
    if (this.connection.isIdle()) {
      this.client.publish({peerStatus: STATUS.available});
    }
    const expired = this.peersPanel.clean();
    for (const peerId of expired) {
      if (this.offerDialog.isOfferTo(peerId)) {
        this.offerDialog.setClosed('The other peer left the channel.');
        break;
      }
    }
    this.offersDialog.clean();
    if (!this.offersDialog.hasContent()) {
      this.view.hideModal(this.offersDialog);
    }
  }

  _eventHandler(peerId, eventData) {
    if (eventData.peerStatus === STATUS.ready) {
      this._handleReady(peerId);
    } else if (eventData.peerStatus === STATUS.available) {
      this._handleAvailable(peerId);
    } else if (eventData.peerStatus === STATUS.unavailable) {
      this._handleUnavailable(peerId);
    } else if (eventData.peerStatus === STATUS.gone) {
      this._handleGone(peerId);
    } else {
      logger.error('Bad event', peerId, eventData);
    }
  }

  _messageHandler(peerId, eventData) {
    if (eventData.peerAction === MESSAGES.offer) {
      this._handleOffer(peerId);
    } else if (eventData.peerAction === MESSAGES.accept) {
      this._handleAccept(peerId);
    } else if (eventData.peerAction === MESSAGES.close) {
      this._handleClose(peerId);
    } else if (eventData.peerAction === MESSAGES.error) {
      this._handleError(peerId);
    } else if (eventData.peerStatus === STATUS.available) {
      this._handleAvailable(peerId);
    } else if ('candidate' in eventData) {
      this._handleCandidate(peerId, eventData);
    } else if ('sdp' in eventData) {
      this._handleSdp(peerId, eventData);
    } else {
      logger.error('Bad message', peerId, eventData);
    }
  }

  _puntHandler() {
    this.view.showAlert(
      'Offline. '
      + 'You\'re logged in from another tab '
      + 'or the channel is full.'
    );
  }

  // Peer-specific signal layer message/event handlers.

  _handleOffer(peerId) {
    this.offersDialog.addOffer(
      peerId, this._ignoreOffer.bind(this), this._acceptOffer.bind(this)
    );
    if (this.connection.isIdle() && this.offersDialog.hasContent()) {
      this.view.showModal(this.offersDialog);
    }
  }

  _handleAccept(peerId) {
    if (this.connection.isConnectedTo(peerId)) {
      this.view.showPlayer();
      this.offerDialog.setClosed();
      this.view.hideModal(this.offerDialog);
      this._openConnection(peerId);
    }
  }

  _handleClose(peerId) {
    if (this.offerDialog.isOfferTo(peerId)) {
      this.offerDialog.setClosed('The other peer rejected the offer.');
    } else if (this.connection.isConnectedTo(peerId)) {
      this._closeConnection();
      this.client.publish({peerStatus: STATUS.available});
      if (this.offersDialog.hasContent()) {
        this.view.showModal(this.offersDialog);
      }
    }
    this.offersDialog.removeOffer(peerId);
    if (!this.offersDialog.hasContent()) {
      this.view.hideModal(this.offersDialog);
    }
  }

  _handleError(peerId) {
    if (this.offerDialog.isOfferTo(peerId)) {
      this.offerDialog.setClosed('The other peer failed to connect.');
    }
  }

  _handleReady(peerId) {
    this.offersDialog.removeOffer(peerId);
    if (!this.offersDialog.hasContent()) {
      this.view.hideModal(this.offersDialog);
    }
    this.peersPanel.addPeer(peerId, this._offerConnection.bind(this));
    if (this.connection.isIdle()) {
      this.client.sendInfoMsg(peerId, {peerStatus: STATUS.available});
    }
  }

  _handleAvailable(peerId) {
    this.peersPanel.addPeer(peerId, this._offerConnection.bind(this));
  }

  _handleUnavailable(peerId) {
    this.peersPanel.removePeer(peerId);
  }

  _handleGone(peerId) {
    if (this.offerDialog.isOfferTo(peerId)) {
      this.offerDialog.setClosed('The other peer left the channel.');
    }
    if (this.connection.isConnectedTo(peerId)) {
      this._closeConnection(peerId);
    }
    this.peersPanel.removePeer(peerId);
    this.offersDialog.removeOffer(peerId);
    if (!this.offersDialog.hasContent()) {
      this.view.hideModal(this.offersDialog);
    }
  }

  _handleCandidate(peerId, candidate) {
    if (this.connection.isConnectedTo(peerId)) {
      logger.info('Received candidate');
      const iceHandler = () => {
        this.view.showAlert('ICE failed. Can\'t connect.');
        this._closeConnection();
        this.client.sendInfoMsg(peerId, {peerAction: MESSAGES.error});
        this.client.publish({peerStatus: STATUS.available});
      };
      this.connection.addCandidate(candidate, iceHandler).then(() => {
      }).catch(error => {
        logger.error('Error addng candidate', error);
      });
    }
  }

  _handleSdp(peerId, sdp) {
    if (this.connection.isConnectedTo(peerId)) {
      logger.debug('Received SDP');
      const sdpHandler = (newJsonSdp) => {
        this.client.sendInfoMsg(peerId, newJsonSdp);
        logger.info('Sent SDP');
      };
      this.connection.addSdp(sdp, sdpHandler).then(() => {
      }).catch(error => {
        logger.error('Error adding SDP', error);
      });
    }
  }
}
