/*
 * Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 * CC BY-NC-ND 4.0.
 */
import Client from '../client.js';
import Connection from '../connection.js';
import NameDialog from './name-dialog.js';
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

    // View and nav menu
    this.view = new View();

    // Connection
    this.connection = new Connection();

    // Client
    this.client = new Client();
    this.client.onConnect = this._onConnect.bind(this);
    this.client.onDisconnect = this._onDisconnect.bind(this);
    this.client.onLogin = this._onLogin.bind(this);
    this.client.onLoginError = this._onLoginError.bind(this);
    this.client.onReady = this._onReady.bind(this);
    this.client.onPing = this._onPing.bind(this);
    this.client.onPunt = this._onPunt.bind(this);
    this.client.onEvent = this._onEvent.bind(this);
    this.client.onMessage = this._onMessage.bind(this);

    // Nav menu items
    this.nameButton = this._nameButton();
    this.connectionLabel = this._connectionLabel();
    this.onlineLabel = this._onlineLabel();
    this.offlineLabel = this._offlineLabel();
    this.view.setNavMenu(this.offlineLabel);

    // NameDialog
    this.peerId = null;
    this.peerName = null;
    this.nameDialog = new NameDialog(
      this.view.modalHeader('Enter your name')
    )
    this.nameDialog.onSubmit = this._onSubmitName.bind(this);
    this.nameDialog.onClose = this._onCancelName.bind(this);
    this.nameDialog.onModalEscape = this._onCancelName.bind(this);

    // PeersPanel
    this.peersPanel = new PeersPanel();
    this.peersPanel.displayName = this._displayName;
    this.peersPanel.onOffer = this._onOffer.bind(this);
    this.view.setChannelInfo(...this.peersPanel.panelContent);

    // OfferDialog
    this.offerDialog = new OfferDialog();
    this.offerDialog.onCancel = this._onCancelOffer.bind(this);
    this.offerDialog.onModalEscape = this._onCancelOffer.bind(this);

    // OffersDialog
    this.offersDialog = new OffersDialog(
      this.view.modalHeader('Offers'),
    );
    this.offersDialog.displayName = this._displayName;
    this.offersDialog.onAccept = this._onAcceptOffer.bind(this)
    this.offersDialog.onIgnore = this._onIgnoreOffer.bind(this);
    this.offersDialog.hasModalContent = this._hasOffers.bind(this);
  }

  connect() {
    this.client.connect();
  }

  disconnect() {
    this.client.disconnect();
  }

  // Nav menu label/button builders.

  _nameButton() {
    const button = document.createElement('button');
    button.classList.add('pseudo');
    window.matchMedia(`(min-width: 480px)`).addListener(() => {
      this._updateNameButton();
    });
    button.addEventListener('click', () => {
      this._showNameDialog();
    });
    return button;
  }

  _connectionLabel() {
    const label = document.createElement('label');
    label.classList.add('pseudo', 'button');
    window.matchMedia(`(min-width: 480px)`).addListener(() => {
      this._updateConnectionLabel();
    });
    return label;
  }

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

  _closeConnectionButton(clientId) {
    const button = document.createElement('button');
    button.textContent = 'Close';
    button.classList.add('pseudo');
    button.setAttribute('title', 'Close the connection');
    button.addEventListener('click', () => {
      logger.info('Closing connection');
      this._closeConnection();
      this.client.sendMessage(clientId, {peerAction: MESSAGES.close});
      this.client.publish({
        peerStatus: STATUS.available,
        peerName: this.peerName
      });
      this.view.showModal(this.offersDialog);
    });
    return button;
  }

  // Dialog, callback and message handler utilities/helpers.

  _displayName(clientId, peerName, clipWidth) {
    if (peerName && window.innerWidth < clipWidth) {
      let parts = peerName.split(' ');
      if (parts[0].length > 8) {
        return `${parts[0].substring(0, 6)}..`
      }
      if (parts.length === 1) {
        return parts[0];
      }
      return `${parts[0]}`
    }
    if (peerName) {
      return peerName;
    }
    return clientId.substr(0, 5);
  }

  _updateNameButton() {
    this.nameButton.textContent = this._displayName(
      this.client.clientId, this.peerName, 480
    );
    if (this.peerName) {
      this.nameButton.setAttribute(
        'title', `${this.peerName} (${this.peerId})`
      );
    } else {
      this.nameButton.setAttribute('title', 'Click to change your name');
    }
  }

  _updateConnectionLabel() {
    if (!this.connection.isIdle()) {
      this.connectionLabel.textContent = this._displayName(
        this.connectionLabel.clientId, this.connectionLabel.peerName, 480
      );
      if (this.connectionLabel.peerName) {
        this.connectionLabel.setAttribute(
          'title',
          `${this.connectionLabel.peerName} (${this.connectionLabel.peerId})`
        );
      } else {
        this.connectionLabel.removeAttribute('title');
      }
    }
  }

  _showNameDialog() {
    this.nameDialog.init(this.peerId, this.peerName);
    this.view.showModal(this.nameDialog);
  }

  _subscribe() {
    const onSuccess = () => {
      this.client.publish({
        peerStatus: STATUS.ready,
        peerName: this.peerName
      });
    };
    const onError = () => {
      this.view.showAlert('Subscription error');
    }
    this.client.subscribe(onSuccess, onError);
  }

  _openConnection(clientId, peerName) {
    if (this.connection.isConnectedTo(clientId)) {
      const trackHandler = (track) => {
        this.view.addTrack(track);
      };
      const candidateHandler = (candidate) => {
        this.client.sendMessage(clientId, candidate);
        logger.info('Sent candidate');
      };
      const offerHandler = (sdp) => {
        this.client.sendMessage(clientId, sdp);
        logger.info('Sent SDP');
      };
      const iceHandler = () => {
        this.client.sendMessage(clientId, {peerAction: MESSAGES.error});
        this._closeConnection();
        this.view.showAlert('ICE failed. Can\'t connect.');
        this.view.showModal(this.offersDialog);
        this.client.publish({
          peerStatus: STATUS.available,
          peerName: this.peerName
        });
      };
      this.connectionLabel.clientId = clientId;
      this.connectionLabel.peerName = peerName;
      this.connectionLabel.peerId = this._displayName(clientId);
      this._updateConnectionLabel();
      this.view.setNavStatus(this.connectionLabel);
      this.view.setNavMenu(this._closeConnectionButton(clientId));
      this.connection.open(
        trackHandler, candidateHandler, offerHandler, iceHandler
      );
    }
  }

  _closeConnection() {
    this.view.hidePlayer();
    this.connection.close();
    this.view.setNavStatus(this.nameButton);
    this.view.setNavMenu(this.onlineLabel);
  }

  _hasOffers() {
    return Object.keys(this.offersDialog.offers).length > 0;
  }

  // NameDialog callbacks.

  _onSubmitName(peerName) {
    this.view.hideModal(this.nameDialog);
    this.peerName = peerName; // Validation in modal.
    this._updateNameButton();
    const changed = this.client.setSessionData('peerName', peerName);
    if (changed && this.client.isSubscribed && this.connection.isIdle()) {
      this.client.publish({
        peerStatus: STATUS.available,
        peerName: this.peerName
      });
    } else if (this.client.isConnected() && !this.client.isSubscribed) {
      this._subscribe();
    }
  }

  _onCancelName() {
    this.view.hideModal(this.nameDialog);
    if (!this.client.isSubscribed) {
      this._subscribe();
    }
  }

  // PeersPanel callbacks.

  _onOffer(clientId) {
    const onSuccess = () => {
      this.client.sendMessage(
        clientId, {peerAction: MESSAGES.offer, peerName: this.peerName}
      );
      this.client.publish({peerStatus: STATUS.unavailable});
      this.offerDialog.setOffering(clientId);
    };
    const onError = (error) => {
      logger.info('Error offering connection', error.message);
      this.offerDialog.setClosed();
      this.view.showAlert(error.message);
      this.view.showModal(this.offersDialog);
      this.connection.close();
    };
    if (this.connection.isIdle()) {
      logger.info('Offering connection', clientId);
      this.connection.init(clientId, true, location.hostname);
      this.offerDialog.setInitializing();
      this.view.showModal(this.offerDialog);
      this.connection.initUserMedia(onSuccess, onError, true, true);
    }
  }

  _onCancelOffer() {
    if (this.offerDialog.isOffering()) {
      logger.info('Canceling offer');
      this.client.sendMessage(
        this.offerDialog.offerId, {peerAction: MESSAGES.close}
      );
    }
    this.offerDialog.setClosed();
    this.view.hideModal(this.offerDialog);
    this.connection.close();
    this.client.publish(
      {peerStatus: STATUS.available, peerName: this.peerName}
    );
    this.view.showModal(this.offersDialog);
  }

  // OffersDialog callbacks.

  _onIgnoreOffer(clientId) {
    this.offersDialog.removeOffer(clientId);
    this.offersDialog.ignoreOffer(clientId);
    if (!this._hasOffers()) {
      this.view.hideModal(this.offersDialog);
    }
  }

  _onAcceptOffer(clientId, peerName) {
    const onSuccess = () => {
      this.client.sendMessage(
        clientId, {peerAction: MESSAGES.accept, peerName: this.peerName}
      );
      this.client.publish({peerStatus: STATUS.unavailable});
      this._openConnection(clientId, peerName);
      this.offersDialog.removeOffer(clientId);
    };
    const onError = (error) => {
      logger.info('Error accepting offer', clientId, error.message);
      this.client.sendMessage(clientId, {peerAction: MESSAGES.error});
      this.view.showAlert(error.message);
      this._closeConnection();
      this.view.showModal(this.offersDialog);
      this.offersDialog.removeOffer(clientId);
    };
    if (this.connection.isIdle()) {
      logger.info('Accepted offer', clientId);
      this.view.showPlayer();
      this.view.hideModal(this.offersDialog);
      this.connection.init(clientId, false, location.hostname);
      this.connection.initUserMedia(onSuccess, onError, true, true);
    }
  }

  // Client callbacks.

  _onConnect() {
    this.peersPanel.setOnline();
    this.view.setNavMenu(this.onlineLabel);
  }

  _onDisconnect(isTimeout) {
    if (this.client.isConnected()) {
      this.client.publish({peerStatus: STATUS.gone});
    } else {
      this.view.setNavMenu(this.offlineLabel);
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

  _onLogin() {
    this.peerId = this._displayName(this.client.clientId);
  }

  _onLoginError(message) {
    this.view.showAlert(`Login failed. ${message}.`);
  }

  _onReady() {
    this.peerName = this.client.getSessionData('peerName');
    this._updateNameButton();
    this.view.setNavStatus(this.nameButton);
    if (this.client.getSessionData('peerName')) {
      this._subscribe();
    } else {
      this._showNameDialog();
    }
  }

  _onPing() {
    if (this.offerDialog.isOffering()) {
      this.client.sendMessage(
        this.offerDialog.offerId,
        {peerAction: MESSAGES.offer, peerName: this.peerName}
      );
    }
    if (this.connection.isIdle() && this.client.isSubscribed) {
      this.client.publish({
        peerStatus: STATUS.available,
        peerName: this.peerName
      });
    }
    const expired = this.peersPanel.clean();
    for (const clientId of expired) {
      if (this.offerDialog.isOfferTo(clientId)) {
        this.offerDialog.setClosed('The other peer left the channel.');
        break;
      }
    }
    this.offersDialog.clean();
    if (!this._hasOffers()) {
      this.view.hideModal(this.offersDialog);
    }
  }

  _onEvent(clientId, eventData) {
    if (eventData.peerStatus === STATUS.ready) {
      this._handleReady(clientId, eventData.peerName);
    } else if (eventData.peerStatus === STATUS.available) {
      this._handleAvailable(clientId, eventData.peerName);
    } else if (eventData.peerStatus === STATUS.unavailable) {
      this._handleUnavailable(clientId);
    } else if (eventData.peerStatus === STATUS.gone) {
      this._handleGone(clientId);
    } else {
      logger.error('Bad event', clientId, eventData);
    }
  }

  _onMessage(clientId, eventData) {
    if (eventData.peerAction === MESSAGES.offer) {
      this._handleOffer(clientId, eventData.peerName);
    } else if (eventData.peerAction === MESSAGES.accept) {
      this._handleAccept(clientId, eventData.peerName);
    } else if (eventData.peerAction === MESSAGES.close) {
      this._handleClose(clientId);
    } else if (eventData.peerAction === MESSAGES.error) {
      this._handleError(clientId);
    } else if (eventData.peerStatus === STATUS.available) {
      this._handleAvailable(clientId, eventData.peerName);
    } else if ('candidate' in eventData) {
      this._handleCandidate(clientId, eventData);
    } else if ('sdp' in eventData) {
      this._handleSdp(clientId, eventData);
    } else {
      logger.error('Bad message', clientId, eventData);
    }
  }

  _onPunt() {
    this.view.showAlert(
      'Offline. '
      + 'You\'re logged in from another tab '
      + 'or the channel is full.'
    );
  }

  // Client message/event handlers.

  _handleOffer(clientId, peerName) {
    if (!peerName || !this.nameDialog.isValid(peerName)) {
      peerName = '';
    }
    this.offersDialog.addOffer(clientId, peerName);
    if (this.connection.isIdle()) {
      this.view.showModal(this.offersDialog);
    }
  }

  _handleAccept(clientId, peerName) {
    if (this.connection.isConnectedTo(clientId)) {
      if (!peerName || !this.nameDialog.isValid(peerName)) {
        peerName = '';
      }
      this.view.showPlayer();
      this.offerDialog.setClosed();
      this.view.hideModal(this.offerDialog);
      this._openConnection(clientId, peerName);
    }
  }

  _handleClose(clientId) {
    if (this.offerDialog.isOfferTo(clientId)) {
      this.offerDialog.setClosed('The other peer rejected the offer.');
    } else if (this.connection.isConnectedTo(clientId)) {
      this._closeConnection();
      this.client.publish({
        peerStatus: STATUS.available,
        peerName: this.peerName
      });
      this.view.showModal(this.offersDialog);
    }
    this.offersDialog.removeOffer(clientId);
    if (!this._hasOffers()) {
      this.view.hideModal(this.offersDialog);
    }
  }

  _handleError(clientId) {
    if (this.offerDialog.isOfferTo(clientId)) {
      this.offerDialog.setClosed('The other peer failed to connect.');
    }
  }

  _handleReady(clientId, peerName) {
    if (!peerName || !this.nameDialog.isValid(peerName)) {
      peerName = '';
    }
    this.offersDialog.removeOffer(clientId);
    if (!this._hasOffers()) {
      this.view.hideModal(this.offersDialog);
    }
    this.peersPanel.addPeer(clientId, peerName);
    if (this.connection.isIdle()) {
      this.client.sendMessage(
        clientId, {
          peerStatus: STATUS.available,
          peerName: this.peerName
        }
      );
    }
  }

  _handleAvailable(clientId, peerName) {
    if (!peerName || !this.nameDialog.isValid(peerName)) {
      peerName = '';
    }
    this.peersPanel.addPeer(clientId, peerName);
  }

  _handleUnavailable(clientId) {
    this.peersPanel.removePeer(clientId);
  }

  _handleGone(clientId) {
    if (this.offerDialog.isOfferTo(clientId)) {
      this.offerDialog.setClosed('The other peer left the channel.');
    }
    if (this.connection.isConnectedTo(clientId)) {
      this._closeConnection();
    }
    this.peersPanel.removePeer(clientId);
    this.offersDialog.removeOffer(clientId);
    if (!this._hasOffers()) {
      this.view.hideModal(this.offersDialog);
    }
  }

  _handleCandidate(clientId, candidate) {
    if (this.connection.isConnectedTo(clientId)) {
      logger.info('Received candidate');
      const iceHandler = () => {
        this.view.showAlert('ICE failed. Can\'t connect.');
        this._closeConnection();
        this.client.sendMessage(clientId, {peerAction: MESSAGES.error});
        this.client.publish({
          peerStatus: STATUS.available,
          peerName: this.peerName
        });
      };
      this.connection.addCandidate(candidate, iceHandler).then(() => {
      }).catch(error => {
        logger.error('Error addng candidate', error);
      });
    }
  }

  _handleSdp(clientId, sdp) {
    if (this.connection.isConnectedTo(clientId)) {
      logger.debug('Received SDP');
      const sdpHandler = (newJsonSdp) => {
        this.client.sendMessage(clientId, newJsonSdp);
        logger.info('Sent SDP');
      };
      this.connection.addSdp(sdp, sdpHandler).then(() => {
      }).catch(error => {
        logger.error('Error adding SDP', error);
      });
    }
  }
}
