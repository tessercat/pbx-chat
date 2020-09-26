/*
 * Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 * CC BY-NC-ND 4.0.
 */
import Client from '../client.js';
import Connection from '../connection.js';
import NavStatus from './nav-status.js';
import NavMenu from './nav-menu.js';
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

    // Connection
    this.connection = new Connection();

    // View
    this.view = new View();

    // Nav status
    this.navStatus = new NavStatus();
    this.navStatus.getDisplayName = this._getDisplayName;
    this.navStatus.onRenameEvent = this._rename.bind(this);

    // Nav menu
    this.navMenu = new NavMenu();
    this.navMenu.setOffline();
    this.navMenu.onCloseEvent = this._onCloseEvent.bind(this);
    this.view.setNavMenu(this.navMenu.menu);

    // NameDialog
    this.peerName = null;
    this.nameDialog = new NameDialog(
      this.view.modalHeader('Enter your name')
    )
    this.nameDialog.onSubmit = this._onSubmitName.bind(this);
    this.nameDialog.onClose = this._onCancelName.bind(this);
    this.nameDialog.onModalEscape = this._onCancelName.bind(this);

    // PeersPanel
    this.peersPanel = new PeersPanel();
    this.peersPanel.getDisplayName = this._getDisplayName;
    this.peersPanel.onOffer = this._onOffer.bind(this);
    this.view.setChannelInfo(this.peersPanel.info);

    // OfferDialog
    this.offerDialog = new OfferDialog();
    this.offerDialog.onCancel = this._onCancelOffer.bind(this);
    this.offerDialog.onModalEscape = this._onCancelOffer.bind(this);

    // OffersDialog
    this.offersDialog = new OffersDialog(
      this.view.modalHeader('Offers'),
    );
    this.offersDialog.getDisplayName = this._getDisplayName;
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

  // Callbacks and helpers.

  _getDisplayName(peerName, clipWidth) {
    if (peerName && window.innerWidth < clipWidth) {
      let parts = peerName.split(' ');
      if (parts[0].length > 8) {
        return `${parts[0].substring(0, 6)}..`
      }
      return parts[0];
    }
    if (peerName) {
      return peerName;
    }
    return 'N/A';
  }

  _onCloseEvent(clientId) {
    this._closeConnection('Closing connection');
    this.client.sendMessage(clientId, {peerAction: MESSAGES.close});
    this.client.publish({
      peerStatus: STATUS.available,
      peerName: this.peerName
    });
    this.view.showModal(this.offersDialog);
  }

  _rename() {
    this.nameDialog.init(this.peerName);
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
      this.connection.onTrack = (track) => {
        this.view.addTrack(track);
      };
      this.connection.onSdp = (sdp) => {
        this.client.sendMessage(clientId, sdp);
        logger.info('Sent SDP');
      };
      this.connection.onCandidate = (candidate) => {
        this.client.sendMessage(clientId, candidate);
        logger.info('Sent candidate');
      };
      this.connection.onIceError = () => {
        this.client.sendMessage(clientId, {peerAction: MESSAGES.error});
        this._closeConnection('ICE failed.');
        this.view.showAlert('ICE failed. Can\'t connect.');
        this.view.showModal(this.offersDialog);
        this.client.publish({
          peerStatus: STATUS.available,
          peerName: this.peerName
        });
      };
      this.navStatus.setConnected(clientId, peerName);
      this.view.setNavStatus(this.navStatus.menu);
      this.navMenu.setConnected(clientId);
      this.view.setNavMenu(this.navMenu.menu);
      this.connection.open();
    }
  }

  _closeConnection(...message) {
    logger.info(...message);
    this.view.hidePlayer();
    this.connection.close();
    this.navStatus.setIdle();
    this.view.setNavStatus(this.navStatus.menu);
    this.navMenu.setOnline();
    this.view.setNavMenu(this.navMenu.menu);
  }

  _hasOffers() {
    return Object.keys(this.offersDialog.offers).length > 0;
  }

  // NameDialog callbacks.

  _onSubmitName(peerName) {
    this.view.hideModal(this.nameDialog);
    this.peerName = peerName; // Validation in modal.
    this.navStatus.setPeerName(peerName);
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
      this.client.sendMessage(clientId, {peerAction: MESSAGES.error});
      this._closeConnection('Error accepting offer', clientId, error.message);
      this.view.showAlert(error.message);
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
    this.navMenu.setOnline();
    this.view.setNavMenu(this.navMenu.menu);
    this.peersPanel.setOnline();
  }

  _onDisconnect(isTimeout) {
    if (this.client.isConnected()) {
      this.client.publish({peerStatus: STATUS.gone});
    } else {
      this.navMenu.setOffline();
      this.view.setNavMenu(this.navMenu.menu);
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
          + 'Reload the page to re-join the channel.'
        );
      }
    }
  }

  _onLogin() {
    this.navStatus.setClientId(this.client.clientId);
    this.nameDialog.setClientId(this.client.clientId);
  }

  _onLoginError(message) {
    this.view.showAlert(`Login failed. ${message}.`);
  }

  _onReady() {
    this.peerName = this.client.getSessionData('peerName');
    this.navStatus.setPeerName(this.peerName);
    this.navStatus.setIdle();
    this.view.setNavStatus(this.navStatus.menu);
    if (this.peerName) {
      this._subscribe();
    } else {
      this._rename();
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
      this._closeConnection('The other peer closed the connection', clientId);
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
    if (this.connection.isConnectedTo(clientId)) {
      this._closeConnection('The other peer failed to connect', clientId);
      this.client.publish({
        peerStatus: STATUS.available,
        peerName: this.peerName
      });
      this.offerDialog.setClosed();
      this.view.showAlert('The other peer failed to connect.');
      this.view.showModal(this.offersDialog);
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
      this._closeConnection('The other peer left the channel', clientId);
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
      this.connection.addCandidate(candidate).then(() => {
      }).catch(error => {
        logger.error('Error adding candidate', error);
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
