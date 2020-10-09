/*
 * Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 * CC BY-NC-ND 4.0.
 */
import Client from '../client.js';
import Connection from '../connection.js';
import LocalMedia from '../local-media.js';
import NavStatus from './nav-status.js';
import NavMenu from './nav-menu.js';
import HelpDialog from './help-dialog.js';
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
    this.client.onDisconnect = this._onDisconnect.bind(this);
    this.client.onLoginError = this._onLoginError.bind(this);
    this.client.onReady = this._onReady.bind(this);
    this.client.onPing = this._onPing.bind(this);
    this.client.onPunt = this._onPunt.bind(this);
    this.client.onEvent = this._onEvent.bind(this);
    this.client.onMessage = this._onMessage.bind(this);

    // Connection
    this.connection = new Connection();
    this.localMedia = new LocalMedia();

    // View
    this.view = new View();

    // Nav status
    this.navStatus = new NavStatus();
    this.navStatus.getFullName = this._getFullName;
    this.navStatus.getDisplayName = this._getDisplayName;
    this.navStatus.onOpen = this._showNameDialog.bind(this);

    // Nav menu
    this.navMenu = new NavMenu();
    this.navMenu.onCloseConnection = this._onCloseConnection.bind(this);
    this.navMenu.onOpenHelp = this._onOpenHelp.bind(this);
    this.navMenu.setOffline();
    this.view.setNavMenu(this.navMenu.menu);

    // Help dialog
    this.helpDialog = new HelpDialog(this.view.modalHeader('Troubleshooting'));
    this.helpDialog.onClose = this._onCloseHelp.bind(this);
    this.helpDialog.onModalEscape = this._onCloseHelp.bind(this);

    // NameDialog
    this.nameDialog = new NameDialog(this.view.modalHeader('Enter your name'));
    this.nameDialog.onSubmit = this._onSubmitName.bind(this);
    this.nameDialog.onClose = this._onCancelName.bind(this);
    this.nameDialog.onModalEscape = this._onCancelName.bind(this);

    // PeersPanel
    this.peersPanel = new PeersPanel();
    this.peersPanel.getFullName = this._getFullName;
    this.peersPanel.getDisplayName = this._getDisplayName;
    this.peersPanel.onOffer = this._onOffer.bind(this);
    this.view.setChannelInfo(this.peersPanel.info);

    // OfferDialog
    this.offerDialog = new OfferDialog();
    this.offerDialog.onCancel = this._onCancelOffer.bind(this);
    this.offerDialog.onModalEscape = this._onCancelOffer.bind(this);

    // OffersDialog
    this.offersDialog = new OffersDialog(this.view.modalHeader('Offers'));
    this.offersDialog.getFullName = this._getFullName;
    this.offersDialog.getDisplayName = this._getDisplayName;
    this.offersDialog.onAccept = this._onAcceptOffer.bind(this)
    this.offersDialog.onIgnore = this._onIgnoreOffer.bind(this);
    this.offersDialog.hasModalContent = this.offersDialog.hasOffers;
  }

  // Object state

  connect() {
    if (!this.client.isConnected()) {
      this.peersPanel.setOfflineTrying();
      this.client.connect();
    }
  }

  disconnect() {
    if (this.client.isConnected()) {
      this.client.publish({
        peerStatus: STATUS.gone,
        peerName: this.nameDialog.peerName
      });
      this.client.disconnect();
    } else {
      this.client.disconnect();
      this._disconnect();
    }
  }

  // Static callbacks/helpers

  _getFullName(clientId, peerName) {
    if (peerName) {
      return peerName;
    }
    return clientId.substr(0, 5);
  }

  _getDisplayName(clientId, peerName, clipWidth) {
    if (peerName && window.innerWidth < clipWidth) {
      let peerNameParts = peerName.split(' ');
      if (peerNameParts[0].length > 8) {
        return `${peerNameParts[0].substring(0, 6)}..`
      }
      return peerNameParts[0];
    }
    if (peerName) {
      return peerName;
    }
    return clientId.substr(0, 5);
  }

  // Nav menu callbacks

  _onCloseConnection(clientId) {
    logger.info('Closed connection', clientId);
    this._closeConnection();
    this.client.sendMessage(clientId, {
      peerAction: MESSAGES.close,
      peerName: this.nameDialog.peerName
    });
    this.client.publish({
      peerStatus: STATUS.available,
      peerName: this.nameDialog.peerName
    });
    this.view.showModal(this.offersDialog);
  }

  // HelpDialog callbacks

  _onCloseHelp() {
    this.view.hideModal(this.helpDialog);
  }

  _onOpenHelp() {
    this.view.showModal(this.helpDialog);
  }

  // NameDialog callbacks

  _showNameDialog() {
    this.view.showModal(this.nameDialog);
  }

  _onSubmitName() { // Trust this.nameDialog.peerName
    this.view.hideModal(this.nameDialog);
    this.navStatus.setName(this.client.clientId, this.nameDialog.peerName);
    const changed = this.client.setChannelVar(
      'peerName', this.nameDialog.peerName
    );
    if (changed && this.client.isSubscribed && this.connection.isIdle()) {
      this.client.publish({
        peerStatus: STATUS.available,
        peerName: this.nameDialog.peerName
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

  // PeersPanel callbacks

  _onOffer(clientId, peerName) {
    const onSuccess = () => {
      this.client.sendMessage(clientId, {
        peerAction: MESSAGES.offer,
        peerName: this.nameDialog.peerName
      });
      this.client.publish({
        peerStatus: STATUS.unavailable,
        peerName: this.nameDialog.peerName
      });
      this.offerDialog.setOffering(
        clientId, this._getFullName(clientId, peerName)
      );
    };
    const onError = (error) => {
      logger.info('Error offering connection', error.message);
      this.offerDialog.setClosed();
      this.view.showAlert(error.message);
      this.view.showModal(this.offersDialog);
      this.connection.close();
      this.localMedia.stop();
    };
    if (this.connection.isIdle()) {
      logger.info('Offering connection', clientId);
      this.connection.open(clientId, true, location.hostname);
      this.localMedia.start(onSuccess, onError);
      this.offerDialog.setInitializing();
      this.view.showModal(this.offerDialog);
    }
  }

  _onCancelOffer() {
    if (this.offerDialog.isOffering()) {
      logger.info('Canceling offer');
      this.client.sendMessage(this.offerDialog.clientId, {
        peerAction: MESSAGES.close,
        peerName: this.nameDialog.peerName
      });
    }
    this.offerDialog.setClosed();
    this.view.hideModal(this.offerDialog);
    this.connection.close();
    this.localMedia.stop();
    this.client.publish({
      peerStatus: STATUS.available,
      peerName: this.nameDialog.peerName
    });
    this.view.showModal(this.offersDialog);
  }

  // OffersDialog callbacks

  _onIgnoreOffer(clientId) {
    this.offersDialog.removeOffer(clientId);
    this.offersDialog.ignoreOffer(clientId);
    if (!this.offersDialog.hasOffers()) {
      this.view.hideModal(this.offersDialog);
    }
  }

  _onAcceptOffer(clientId, peerName) {
    const onSuccess = () => {
      this.client.sendMessage(clientId, {
        peerAction: MESSAGES.accept,
        peerName: this.nameDialog.peerName
      });
      this.client.publish({
        peerStatus: STATUS.unavailable,
        peerName: this.nameDialog.peerName
      });
      this._openConnection(clientId, peerName);
      this.offersDialog.removeOffer(clientId);
    };
    const onError = (error) => {
      logger.info('Error accepting offer', clientId, error.message);
      this.client.sendMessage(clientId, {
        peerAction: MESSAGES.error,
        peerName: this.nameDialog.peerName
      });
      this._closeConnection();
      this.view.showAlert(error.message);
      this.view.showModal(this.offersDialog);
      this.offersDialog.removeOffer(clientId);
    };
    if (this.connection.isIdle()) {
      logger.info('Accepted offer', clientId);
      this.view.showPlayer();
      this.view.hideModal(this.offersDialog);
      this.connection.open(clientId, false, location.hostname);
      this.localMedia.start(onSuccess, onError);
    }
  }

  // Connection state helpers

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
        this.client.sendMessage(clientId, {
          peerAction: MESSAGES.error,
          peerName: this.nameDialog.peerName
        });
        logger.info('Failed to connect', clientId);
        this._closeConnection();
        this.view.showAlert('ICE failed. Can\'t connect.');
        this.view.showModal(this.offersDialog);
        this.client.publish({
          peerStatus: STATUS.available,
          peerName: this.nameDialog.peerName
        });
      };
      this.navStatus.setConnected(clientId, peerName);
      this.view.setNavStatus(this.navStatus.menu);
      this.navMenu.setConnected(clientId);
      this.view.setNavMenu(this.navMenu.menu);
      this.connection.addTracks(this.localMedia.mediaStream);
    }
  }

  _closeConnection() {
    this.view.hidePlayer();
    this.connection.close();
    this.localMedia.stop();
    this.navStatus.setIdle();
    this.view.setNavStatus(this.navStatus.menu);
    this.navMenu.setOnline();
    this.view.setNavMenu(this.navMenu.menu);
  }

  // Channel state helpers

  _subscribe() {
    const onSubSuccess = () => {
      const onPubSuccess = () => {
        this.navMenu.setOnline();
        this.view.setNavMenu(this.navMenu.menu);
        this.peersPanel.setOnline();
      };
      const onPubError = () => {
        this.view.showAlert('Channel access error');
        this.disconnect();
      }
      this.client.publish({
        peerStatus: STATUS.ready,
        peerName: this.nameDialog.peerName
      }, onPubSuccess, onPubError);
    };
    const onSubError = () => {
      this.view.showAlert('Subscription error');
      this.disconnect();
    }
    this.client.subscribe(onSubSuccess, onSubError);
  }

  _disconnect(isTimeout) {
    this.navMenu.setOffline();
    this.view.setNavMenu(this.navMenu.menu);
    this.peersPanel.reset();
    if (this.client.isTrying()) {
      this.peersPanel.setOfflineTrying();
    } else {
      this.peersPanel.setOffline();
    }
    this.offersDialog.reset();
    this.view.hideModal(this.offersDialog);
    if (this.offerDialog.isOffering()) {
      this.offerDialog.setClosed('You left the channel.');
    } else if (isTimeout) {
      this.view.showAlert('Offline. Timed out.');
    }
  }

  // Channel state callbacks

  _onDisconnect(isTimeout) {
    this._disconnect(isTimeout);
  }

  _onLoginError(message) {
    this.view.showAlert(`Login failed. ${message}.`);
  }

  _onReady() {
    this.nameDialog.setName(
      this.client.clientId,
      this.client.getChannelVar('peerName')
    );
    this.navStatus.setName(this.client.clientId, this.nameDialog.peerName);
    this.navStatus.setIdle();
    this.view.setNavStatus(this.navStatus.menu);
    if (this.nameDialog.peerName) {
      this._subscribe();
    } else {
      this._showNameDialog();
    }
  }

  _onPing() {
    if (this.offerDialog.isOffering()) {
      this.client.sendMessage(this.offerDialog.clientId, {
        peerAction: MESSAGES.offer,
        peerName: this.nameDialog.peerName
      });
    }
    if (this.connection.isIdle() && this.client.isSubscribed) {
      this.client.publish({
        peerStatus: STATUS.available,
        peerName: this.nameDialog.peerName
      });
    }
    const expired = this.peersPanel.clean();
    for (const clientId of expired) {
      if (this.offerDialog.isOfferTo(clientId)) {
        logger.info('Peer left channel', clientId);
        this.offerDialog.setClosed('left the channel');
        break;
      }
    }
    this.offersDialog.clean();
    if (!this.offersDialog.hasOffers()) {
      this.view.hideModal(this.offersDialog);
    }
  }

  _onEvent(clientId, eventData) {
    const peerName = this.nameDialog.getValid(eventData.peerName);
    if (eventData.peerStatus === STATUS.ready) {
      this._handleReady(clientId, peerName);
    } else if (eventData.peerStatus === STATUS.available) {
      this._handleAvailable(clientId, peerName);
    } else if (eventData.peerStatus === STATUS.unavailable) {
      this._handleUnavailable(clientId, peerName);
    } else if (eventData.peerStatus === STATUS.gone) {
      this._handleGone(clientId, peerName);
    } else {
      logger.error('Error handling event', clientId, eventData);
    }
  }

  _onMessage(clientId, eventData) {
    const peerName = this.nameDialog.getValid(eventData.peerName);
    if (eventData.peerAction === MESSAGES.offer) {
      this._handleOffer(clientId, peerName);
    } else if (eventData.peerAction === MESSAGES.accept) {
      this._handleAccept(clientId, peerName);
    } else if (eventData.peerAction === MESSAGES.close) {
      this._handleClose(clientId, peerName);
    } else if (eventData.peerAction === MESSAGES.error) {
      this._handleError(clientId, peerName);
    } else if (eventData.peerStatus === STATUS.available) {
      this._handleAvailable(clientId, peerName);
    } else if ('candidate' in eventData) {
      this._handleCandidate(clientId, eventData);
    } else if ('sdp' in eventData) {
      this._handleSdp(clientId, eventData);
    } else {
      logger.error('Error handling message', clientId, eventData);
    }
  }

  _onPunt() {
    this.view.showAlert(
      'Offline. '
      + 'You\'re logged in from another tab '
      + 'or the channel is full.'
    );
  }

  // Client message/event handlers

  _handleOffer(clientId, peerName) {
    this.offersDialog.addOffer(clientId, peerName);
    if (this.connection.isIdle()) {
      this.view.showModal(this.offersDialog);
    }
  }

  _handleAccept(clientId, peerName) {
    if (this.connection.isConnectedTo(clientId)) {
      this.view.showPlayer();
      this.offerDialog.setClosed();
      this.view.hideModal(this.offerDialog);
      this._openConnection(clientId, peerName);
    }
  }

  _handleClose(clientId) {
    if (this.offerDialog.isOfferTo(clientId)) {
      this.offerDialog.setClosed('rejected the offer');
      logger.info('Peer rejected offer', clientId);
    } else if (this.connection.isConnectedTo(clientId)) {
      this._closeConnection();
      this.client.publish({
        peerStatus: STATUS.available,
        peerName: this.nameDialog.peerName
      });
      this.view.showModal(this.offersDialog);
      logger.info('Peer closed connection', clientId);
    }
    this.offersDialog.removeOffer(clientId);
    if (!this.offersDialog.hasOffers()) {
      this.view.hideModal(this.offersDialog);
    }
  }

  _handleError(clientId, peerName) {
    if (this.connection.isConnectedTo(clientId)) {
      logger.info('Peer failed to connect', clientId);
      this._closeConnection();
      this.client.publish({
        peerStatus: STATUS.available,
        peerName: this.nameDialog.peerName
      });
      this.offerDialog.setClosed();
      this.view.showAlert(
        `${this._getFullName(clientId, peerName)} failed to connect.`
      );
      this.view.showModal(this.offersDialog);
    }
  }

  _handleReady(clientId, peerName) {
    this.offersDialog.removeOffer(clientId);
    if (!this.offersDialog.hasOffers()) {
      this.view.hideModal(this.offersDialog);
    }
    this.peersPanel.addPeer(clientId, peerName);
    if (this.connection.isIdle()) {
      this.client.sendMessage(
        clientId, {
          peerStatus: STATUS.available,
          peerName: this.nameDialog.peerName
        }
      );
    }
  }

  _handleAvailable(clientId, peerName) {
    this.peersPanel.addPeer(clientId, peerName);
  }

  _handleUnavailable(clientId) {
    this.peersPanel.removePeer(clientId);
  }

  _handleGone(clientId) {
    logger.info('Peer left channel', clientId);
    if (this.offerDialog.isOfferTo(clientId)) {
      this.offerDialog.setClosed('left the channel');
    }
    if (this.connection.isConnectedTo(clientId)) {
      this._closeConnection();
    }
    this.peersPanel.removePeer(clientId);
    this.offersDialog.removeOffer(clientId);
    if (!this.offersDialog.hasOffers()) {
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
