/*
 * Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 * CC BY-NC-ND 4.0.
 */
import logger from '../logger.js';

export default class PeersPanel {

  constructor() {
    this.panel = this._panel();
    this.info = this.panel;
    this.statusMsg = this._statusMsg();
    this.setOffline();
    this.panel.append(this.statusMsg);
    this.peers = {};
    this.onOffer = () => {};
    this.getDisplayName = () => {return 'N/A'};
  }

  _panel() {
    const div = document.createElement('div');
    div.style.marginLeft = 'auto';
    div.style.marginRight = 'auto';
    div.style.maxWidth = '600px'
    div.style.padding = '1em';
    const mm = matchMedia('(min-width: 480px)');
    mm.addListener((mm) => {
      if (mm.matches) {
        div.style.maxWidth = '480px'
      } else {
        div.style.maxWidth = '100%';
      }
      for (const clientId in this.peers) {
        this._setPeerName(this.peers[clientId]);
      }
    });
    return div;
  }

  _setPeerName(peer) {
    if (peer.peerName) {
      peer.label.textContent = this.getDisplayName(peer.peerName, 480);
      peer.label.setAttribute('title', `${peer.peerName} (${peer.peerId})`);
      peer.offerButton.setAttribute(
        'title', `Connect to ${peer.peerName} (${peer.peerId})`
      );
    } else {
      peer.label.textContent = peer.peerId;
      peer.label.removeAttribute('title');
      peer.offerButton.setAttribute('title', `Connect to ${peer.peerId}`);
    }
  }

  _statusMsg() {
    const p = document.createElement('p');
    p.style.textAlign = 'center';
    return p;
  }

  setOnline() {
    this.statusMsg.innerHTML = 'Online. Waiting for others to join.';
  }

  setOffline() {
    this.statusMsg.innerHTML = 'Offline.';
  }

  addPeer(clientId, peerName) {
    if (this.peers[clientId]) {
      this.peers[clientId].added = new Date();
      if (peerName !== this.peers[clientId].peerName) {
        this.peers[clientId].peerName = peerName;
        this._setPeerName(this.peers[clientId]);
      }
      return;
    }
    if (Object.keys(this.peers).length === 0) {
      this.statusMsg.remove();
    }
    const peer = document.createElement('article');
    peer.classList.add('card');
    const section = document.createElement('section');
    section.style.padding = '0.5em';
    peer.append(section);
    const label = document.createElement('label');
    label.classList.add('button', 'pseudo');
    section.append(label);
    const offerButton = document.createElement('button')
    offerButton.textContent = 'Connect';
    offerButton.style.float = 'right';
    offerButton.addEventListener('click', () => {
      this.onOffer(clientId);
    });
    section.append(offerButton);
    peer.added = new Date();
    peer.clientId = clientId;
    peer.peerId = clientId.substr(0, 5);
    peer.peerName = peerName;
    peer.offerButton = offerButton;
    peer.label = label;
    this.peers[clientId] = peer;
    this._setPeerName(peer);
    this.panel.append(peer);
    logger.info('Added peer', clientId);
  }

  removePeer(clientId) {
    const peer = this.peers[clientId];
    delete this.peers[clientId];
    if (peer) {
      peer.remove();
      logger.info('Removed peer', clientId);
    }
    if (Object.keys(this.peers).length === 0) {
      this.panel.append(this.statusMsg);
    }
  }

  reset() {
    Object.keys(this.peers).forEach(clientId => {
      this.removePeer(clientId);
    });
  }

  clean() {
    const expired = [];
    const now = new Date();
    logger.debug('Cleaning expired peers');
    for (const clientId in this.peers) {
      const diff = now - this.peers[clientId].added;
      if (diff > 60000) {
        expired.push(clientId);
      }
    }
    for (const clientId of expired) {
      logger.info('Peer expired', clientId);
      this.removePeer(clientId);
    }
    return expired;
  }
}
