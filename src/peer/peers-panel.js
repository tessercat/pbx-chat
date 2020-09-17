/*
 * Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 * CC BY-NC-ND 4.0.
 */
import logger from '../logger.js';

export default class PeersPanel {

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
      this.peers[peerId].added = new Date();
      return;
    }
    if (Object.keys(this.peers).length === 0) {
      this.statusMsg.remove();
    }
    const peerName = peerId.substr(0, 5);
    const peer = document.createElement('article');
    peer.added = new Date();
    peer.classList.add('card');
    const section = document.createElement('section');
    section.style.padding = '0.5em';
    peer.append(section);
    const label = document.createElement('label');
    label.textContent = peerName;
    label.classList.add('pseudo', 'button');
    section.append(label);
    const offerButton = document.createElement('button')
    offerButton.textContent = 'Connect';
    offerButton.setAttribute('title', `Connect to ${peerName}`);
    offerButton.style.float = 'right';
    offerButton.addEventListener('click', () => {
      offerHandler(peerId);
    });
    section.append(offerButton);
    this.peers[peerId] = peer;
    this.panel.append(peer);
    logger.info('Added peer', peerId);
  }

  removePeer(peerId) {
    const peer = this.peers[peerId];
    delete this.peers[peerId];
    if (peer) {
      peer.remove();
      logger.info('Removed peer', peerId);
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

  clean() {
    const expired = [];
    const now = new Date();
    logger.debug('Cleaning expired peers');
    for (const peerId in this.peers) {
      const diff = now - this.peers[peerId].added;
      if (diff > 60000) {
        expired.push(peerId);
      }
    }
    for (const peerId of expired) {
      logger.info('Peer expired', peerId);
      this.removePeer(peerId);
    }
    return expired;
  }
}
