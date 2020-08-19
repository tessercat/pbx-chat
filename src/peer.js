/*
 * Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 * CC BY-NC-ND 4.0.
 */
import Client from './client.js';
import Connection from './connection.js';
import View from './view.js';
import logger from './logger.js';

class PeersDialog {

  constructor(view) {
    this.header = view.getModalHeader('Peers');
    this.peers = this._peersPanel();
    this.footer = document.createElement("footer")
    this.offers = {};
    this.offersDiv = this.peers.querySelector("#offering-peers");
    this.available = {};
    this.availableDiv = this.peers.querySelector("#available-peers");
  }

  _peersPanel() {
    const section = document.createElement("section");
    const offering = document.createElement("div");
    offering.setAttribute("id", "offering-peers");
    section.append(offering);
    const available = document.createElement("div");
    available.setAttribute("id", "available-peers");
    section.append(available);
    return section;
  }

  // Public methods.

  getContent() {
    return [this.header, this.peers, this.footer];
  }

  addPeer(peerId, peerName, offerHandler) {
    if (this.available[peerId]) {
      return;
    }
    const peer = document.createElement("article");
    peer.classList.add("card");
    const section = document.createElement("section");
    peer.append(section);
    const label = document.createElement("label");
    label.textContent = peerName;
    label.classList.add("pseudo", "button");
    section.append(label);
    const button = document.createElement("button")
    button.textContent = "Call";
    button.setAttribute("title", `Call ${peerName}`);
    button.style.float = "right";
    button.addEventListener("click", () => {
      offerHandler(peerId);
    });
    section.append(button);
    logger.info('Adding peer', peerName);
    this.available[peerId] = peer;
    this.availableDiv.append(peer);
  }

  removePeer(peerId, peerName) {
    const peer = this.available[peerId];
    delete this.available[peerId];
    if (peer) {
      logger.info('Removing peer', peerName);
      peer.remove();
    }
  }

  addOffer(peerId, peerName, acceptHandler) {
    if (this.offers[peerId]) {
      return;
    }
    const peer = document.createElement("article");
    peer.classList.add("card")
    const section = document.createElement("section");
    peer.append(section);
    const label = document.createElement("label");
    label.textContent = peerName;
    label.classList.add("pseudo", "button");
    section.append(label);
    const button = document.createElement("button")
    button.textContent = "Answer";
    button.setAttribute("title", `Answer ${peerName}`);
    button.style.float = "right";
    button.classList.add("success");
    button.addEventListener("click", () => {
      acceptHandler(peerId);
    });
    section.append(button);
    logger.info('Adding offer', peerName);
    this.offers[peerId] = peer;
    this.offersDiv.append(peer);
  }

  removeOffer(peerId, peerName) {
    const peer = this.offers[peerId];
    delete this.offers[peerId];
    if (peer) {
      logger.info('Removing offer', peerName);
      peer.remove();
    }
  }
}

export default class Peer {

  constructor() {
    this.view = new View();
    this.peers = new PeersDialog(this.view);
    this.peersButton = this._peersButton();
    this.disconnectButton = this._disconnectButton();
    this.offerDialog = this._offerDialog();
    this.view.setModalContent(...this.peers.getContent());
    this.view.setNavMenuContent(this.peersButton);
    this.connection = null;
  }

  _peerName(peerId) {
    return peerId.substr(0, 5);
  }

  _peersButton() {
    const button = document.createElement("button");
    button.textContent = "Peers";
    button.classList.add("pseudo");
    button.setAttribute("title", "Show peers list");
    button.addEventListener("click", () => {
      if (!this.connection) {
        this.view.showModal();
      }
    });
    return button;
  }

  _disconnectButton() {
    const button = document.createElement("button");
    button.textContent = "Disconnect";
    button.classList.add("pseudo");
    button.setAttribute("title", "Close the connection");
    button.addEventListener("click", () => {
      this._closeHandler();
    });
    return button;
  }

  _offerDialog() {
    const section = document.createElement("section");
    section.textContent = `Offer sent. Waiting for an answer.`;
    const button = document.createElement("button");
    button.textContent = "Cancel";
    button.setAttribute("title", "Cancel the offer");
    button.style.float = "right";
    button.addEventListener("click", () => {
      this._closeHandler();
      this.view.showModal();
    });
    const footer = document.createElement("footer");
    footer.append(button);
    return [section, footer];
  }

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
    this.view.removeTracks();
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }
    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }
  }

  // Peer-to-peer event handlers.

  _offerHandler(peerId) {
    const onSuccess = () => {
      this.client.publishPresence(false);
      this.client.sendInfoMsg(this.connection.peerId, 'offer');
      this.view.setModalContent(...this.offerDialog);
      this.view.showModal(true);
    };
    const onError = (error) => {
      logger.error(error);
      this._closeHandler();
      this.view.showAlert(error.message);
    };
    if (!this.connection) {
      this.connection = new Connection(true);
      this.connection.peerId = peerId;
      this.connection.initUserMedia(onSuccess, onError);
    }
  }

  _acceptHandler(peerId) {
    const onSuccess = () => {
      this.client.sendInfoMsg(this.connection.peerId, 'accept');
      this.view.hideModal();
      this.view.setNavMenuContent(this.disconnectButton);
      this._initConnection();
    };
    const onError = (error) => {
      logger.error(error);
      this._closeHandler();
      this.view.showAlert(error.message);
    };
    if (!this.connection) {
      this.connection = new Connection(false);
      this.connection.peerId = peerId;
      this.connection.initUserMedia(onSuccess, onError);
    }
  }

  _closeHandler() {
    if (this.connection) {
      this.view.hideModal();
      this.view.setModalContent(...this.peers.getContent());
      this.view.setNavMenuContent(this.peersButton);
      this.view.removeTracks();
      this.client.sendInfoMsg(this.connection.peerId, 'close');
      this.client.publishPresence(true);
      this.connection.close();
      this.connection = null;
    }
  }

  // Peer connection init method.

  _initConnection() {
    const trackHandler = (track) => {
      this.view.addTrack(track);
      logger.info('Added remote', track.kind);
    }
    const candidateHandler = (jsonCandidate) => {
      const stringCandidate = JSON.stringify(jsonCandidate);
      this.client.sendInfoMsg(this.connection.peerId, stringCandidate);
      logger.info('Sent candidate');
    }
    const offerHandler = (jsonSdp) => {
      const stringSdp = JSON.stringify(jsonSdp);
      this.client.sendInfoMsg(this.connection.peerId, stringSdp);
      logger.info('Sent description');
    }
    if (this.connection) {
      this.connection.init(trackHandler, candidateHandler, offerHandler);
      this.connection.addTracks();
    }
  }

  // Peer-to-peer calling protocol message handlers.

  _presenceEventHandler(peerId, isAvailable) {
    if (isAvailable) {
      this.peers.addPeer(
        peerId, this._peerName(peerId), this._offerHandler.bind(this)
      );
      if (!this.connection) {
        this.client.sendInfoMsg(peerId, "available");
      }
    } else {
      this.peers.removePeer(peerId, this._peerName(peerId));
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

  _handleOffer(peerId) {
    this.peers.addOffer(
      peerId, this._peerName(peerId), this._acceptHandler.bind(this)
    );
  }

  _handleAccept(peerId) {
    if (this.connection && this.connection.peerId === peerId) {
      this.view.hideModal();
      this.view.setNavMenuContent(this.disconnectButton);
      this._initConnection();
    }
  }

  _handleClose(peerId) {
    if (this.connection && this.connection.peerId === peerId) {
      this.view.removeTracks();
      this.connection.close();
      this.connection = null;
      this.view.setNavMenuContent(this.peersButton);
    } else {
      this.peers.removeOffer(peerId, this._peerName(peerId));
    }
  }

  _handlePresenceInfo(peerId, isAvailable) {
    if (isAvailable) {
      this.peers.addPeer(
        peerId, this._peerName(peerId), this._offerHandler.bind(this)
      );
    } else {
      this.peers.removePeer(peerId, this._peerName(peerId));
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
      }
      this.connection.addSdp(jsonSdp, sdpHandler).then(() => {
      }).catch(error => {
        logger.error(error);
      });
    }
  }
}
