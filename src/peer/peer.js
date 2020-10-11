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
    this.connection.isOffering = undefined;

    // Local media
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
    this.navMenu.onCloseConnection = this._closeConnection.bind(this);
    this.navMenu.onOpenHelp = this._openHelp.bind(this);
    this.navMenu.setOffline();
    this.view.setNavMenu(this.navMenu.menu);

    // Help dialog
    this.helpDialog = new HelpDialog(this.view.modalHeader('Troubleshooting'));
    this.helpDialog.onClose = this._closeHelp.bind(this);
    this.helpDialog.onModalEscape = this._closeHelp.bind(this);

    // Name dialog
    this.nameDialog = new NameDialog(this.view.modalHeader('Enter your name'));
    this.nameDialog.onSubmit = this._setName.bind(this);
    this.nameDialog.onClose = this._closeNameDialog.bind(this);
    this.nameDialog.onModalEscape = this._closeNameDialog.bind(this);

    // Peers panel
    this.peersPanel = new PeersPanel();
    this.peersPanel.getFullName = this._getFullName;
    this.peersPanel.getDisplayName = this._getDisplayName;
    this.peersPanel.onOffer = this._sendOffer.bind(this);
    this.view.setChannelInfo(this.peersPanel.info);

    // Offers dialog
    this.offersDialog = new OffersDialog(this.view.modalHeader('Offers'));
    this.offersDialog.getFullName = this._getFullName;
    this.offersDialog.getDisplayName = this._getDisplayName;
    this.offersDialog.onAccept = this._acceptOffer.bind(this)
    this.offersDialog.onIgnore = this._ignoreOffer.bind(this);
    this.offersDialog.hasModalContent = this.offersDialog.hasOffers;
  }

  // Client state

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

  // Nav and dialog callbacks

  _closeConnection(clientId) {
    if (this.connection.isConnectedTo(clientId)) {
      logger.info('Closing connection', clientId);
      this._close(clientId);
      this.client.sendMessage(clientId, {
        peerAction: MESSAGES.close,
        peerName: this.nameDialog.peerName
      });
    }
  }

  _openHelp() {
    this.view.showModal(this.helpDialog);
  }

  _closeHelp() {
    this.view.hideModal(this.helpDialog);
  }

  _showNameDialog() {
    this.view.showModal(this.nameDialog);
  }

  _closeNameDialog() {
    this.view.hideModal(this.nameDialog);
    if (!this.client.isSubscribed) {
      this._subscribe();
    }
  }

  _setName() { // Trust this.nameDialog.peerName
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

  // Offer callbacks

  _isOfferTo(clientId) {
    if (this.connection.isOffering && this.connection.clientId === clientId) {
      return true;
    }
    return false;
  }

  _sendOffer(clientId, peerName) {
    if (this.connection.isIdle()) {
      const onSuccess = () => {
        this.client.sendMessage(clientId, {
          peerAction: MESSAGES.offer,
          peerName: this.nameDialog.peerName
        });
        this.client.publish({
          peerStatus: STATUS.unavailable,
          peerName: this.nameDialog.peerName
        });
        this._open(clientId, peerName, true);
        this.view.showAlert(`Offer sent. Waiting for ${peerName}.`);
      };
      const onError = (error) => {
        logger.info('Error offering connection', error.message);
        this.view.showAlert(error.message);
        this.view.showModal(this.offersDialog);
        this.connection.close();
        this.localMedia.stop();
        this.connection.isOffering = undefined;
      };
      logger.info('Offering connection', clientId);
      this.connection.isOffering = true;
      this.view.showAlert('Starting local media.');
      this.localMedia.start(onSuccess, onError);
    }
  }

  _ignoreOffer(clientId) {
    this.offersDialog.removeOffer(clientId);
    this.offersDialog.ignoreOffer(clientId);
    if (!this.offersDialog.hasOffers()) {
      this.view.hideModal(this.offersDialog);
    }
  }

  _acceptOffer(clientId, peerName) {
    if (this.connection.isIdle()) {
      const onSuccess = () => {
        this.client.sendMessage(clientId, {
          peerAction: MESSAGES.accept,
          peerName: this.nameDialog.peerName
        });
        this.client.publish({
          peerStatus: STATUS.unavailable,
          peerName: this.nameDialog.peerName
        });
        this.view.showAlert('Connecting...');
        this._open(clientId, peerName, false);
        this.connection.addTracks(this.localMedia.mediaStream);
        this.offersDialog.removeOffer(clientId);
      };
      const onError = (error) => {
        logger.info('Error accepting offer', clientId, error.message);
        this._close(clientId, error.message);
        this.client.sendMessage(clientId, {
          peerAction: MESSAGES.error,
          peerName: this.nameDialog.peerName
        });
        this.offersDialog.removeOffer(clientId);
      };
      logger.info('Accepted offer', clientId);
      this.view.hideModal(this.offersDialog);
      this.view.showAlert('Starting local media.');
      this.localMedia.start(onSuccess, onError);
    }
  }

  // Connection state helpers

  _open(clientId, peerName, isPolite) {
    if (this.connection.isIdle()) {
      this.connection.onTrack = (track) => {
        this.view.hideAlert();
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
        logger.info('Failed to connect', clientId);
        this._close(clientId, 'ICE failed. Can\'t connect.');
        this.client.sendMessage(clientId, {
          peerAction: MESSAGES.error,
          peerName: this.nameDialog.peerName
        });
      };
      this.view.showPlayer();
      this.navStatus.setConnected(clientId, peerName);
      this.view.setNavStatus(this.navStatus.menu);
      this.navMenu.setConnected(clientId);
      this.view.setNavMenu(this.navMenu.menu);
      this.connection.open(clientId, isPolite, location.hostname);
    }
  }

  _close(clientId, message) {
    if (message) {
      this.view.showAlert(message);
    }
    this.view.hidePlayer();
    this.connection.close();
    this.localMedia.stop();
    this.navStatus.setIdle();
    this.view.setNavStatus(this.navStatus.menu);
    this.navMenu.setOnline();
    this.view.setNavMenu(this.navMenu.menu);
    this.view.showModal(this.offersDialog);
    if (this.connection.isOffering) {
      this.connection.isOffering = undefined;
      this.client.sendMessage(clientId, {
        peerAction: MESSAGES.close,
        peerName: this.nameDialog.peerName
      });
    }
    this.client.publish({
      peerStatus: STATUS.available,
      peerName: this.nameDialog.peerName
    });
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
    if (this.connection.isOffering) {
      this._close(this.connection.clientId, 'You left the channel');
    } else if (isTimeout) {
      this.view.showAlert('Offline. Timed out.');
    }
  }

  // Client callbacks

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
    if (this.connection.isOffering) {
      this.client.sendMessage(this.connection.clientId, {
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
    for (const peer of expired) {
      if (this._isOfferTo(peer.clientId)) {
        logger.info('Peer left channel', peer.clientId);
        this._close(peer.clientId, `${peer.peerName} left the channel.`);
        break;
      }
    }
    this.offersDialog.clean();
    if (!this.offersDialog.hasOffers()) {
      this.view.hideModal(this.offersDialog);
    }
  }

  _onMessage(clientId, eventData) {
    const peerName = this.nameDialog.getValid(eventData.peerName);
    if (eventData.peerStatus === STATUS.available) {
      this._onAvailableMessage(clientId, peerName);
    } else if (eventData.peerAction === MESSAGES.offer) {
      this._onOfferMessage(clientId, peerName);
    } else if (eventData.peerAction === MESSAGES.accept) {
      this._onAcceptMessage(clientId, peerName);
    } else if (eventData.peerAction === MESSAGES.close) {
      this._onCloseMessage(clientId, peerName);
    } else if (eventData.peerAction === MESSAGES.error) {
      this._onErrorMessage(clientId, peerName);
    } else if ('candidate' in eventData) {
      this._onCandidateMessage(clientId, eventData);
    } else if ('sdp' in eventData) {
      this._onSdpMessage(clientId, eventData);
    } else {
      logger.error('Error handling message', clientId, eventData);
    }
  }

  _onEvent(clientId, eventData) {
    const peerName = this.nameDialog.getValid(eventData.peerName);
    if (eventData.peerStatus === STATUS.ready) {
      this._onReadyEvent(clientId, peerName);
    } else if (eventData.peerStatus === STATUS.available) {
      this._onAvailableEvent(clientId, peerName);
    } else if (eventData.peerStatus === STATUS.unavailable) {
      this._onUnavailableEvent(clientId, peerName);
    } else if (eventData.peerStatus === STATUS.gone) {
      this._onGoneEvent(clientId, peerName);
    } else {
      logger.error('Error handling event', clientId, eventData);
    }
  }

  _onPunt() {
    this.view.showAlert(
      'Offline. '
      + 'You\'re logged in from another tab '
      + 'or the channel is full.'
    );
  }

  // Client message handlers

  _onAvailableMessage(clientId, peerName) {
    this.peersPanel.addPeer(clientId, peerName);
  }

  _onOfferMessage(clientId, peerName) {
    this.offersDialog.addOffer(clientId, peerName);
    if (this.connection.isIdle()) {
      this.view.showModal(this.offersDialog);
    }
  }

  _onAcceptMessage(clientId) {
    if (this._isOfferTo(clientId)) {
      this.connection.isOffering = undefined;
      this.view.showAlert('Connecting...');
      this.connection.addTracks(this.localMedia.mediaStream);
    }
  }

  _onCloseMessage(clientId, peerName) {
    if (this.connection.isConnectedTo(clientId)) {
      if (this._isOfferTo(clientId)) {
        logger.info('Peer rejected offer', clientId);
        this._close(clientId, `${peerName} rejected the offer.`);
      } else {
        logger.info('Peer closed connection', clientId);
        this._close(clientId, `${peerName} closed the connection.`);
      }
    }
    this.offersDialog.removeOffer(clientId);
    if (!this.offersDialog.hasOffers()) {
      this.view.hideModal(this.offersDialog);
    }
  }

  _onErrorMessage(clientId, peerName) {
    if (this.connection.isConnectedTo(clientId)) {
      logger.info('Peer failed to connect', clientId);
      this._close(clientId, `${peerName} failed to connect.`);
    }
  }

  _onCandidateMessage(clientId, candidate) {
    if (this.connection.isConnectedTo(clientId)) {
      logger.info('Received candidate');
      this.connection.addCandidate(candidate).then(() => {
      }).catch(error => {
        logger.error('Error adding candidate', error);
      });
    }
  }

  _onSdpMessage(clientId, sdp) {
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

  // Client event handlers

  _onReadyEvent(clientId, peerName) {
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

  _onAvailableEvent(clientId, peerName) {
    this.peersPanel.addPeer(clientId, peerName);
  }

  _onUnavailableEvent(clientId) {
    this.peersPanel.removePeer(clientId);
  }

  _onGoneEvent(clientId, peerName) {
    logger.info('Peer left channel', clientId);
    if (this.connection.isConnectedTo(clientId)) {
      this._close(clientId, `${peerName} left the channel.`);
    }
    this.peersPanel.removePeer(clientId);
    this.offersDialog.removeOffer(clientId);
    if (!this.offersDialog.hasOffers()) {
      this.view.hideModal(this.offersDialog);
    }
  }
}
