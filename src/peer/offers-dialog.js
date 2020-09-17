/*
 * Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 * CC BY-NC-ND 4.0.
 */
import logger from '../logger.js';

export default class OffersDialog {

  constructor(view) {
    this.header = view.getModalHeader('Offers');
    this.panel = document.createElement('section');
    this.footer = document.createElement('footer');
    this.offers = {};
    this.ignored = {};
  }

  getContent() {
    return [this.header, this.panel, this.footer];
  }

  hasContent() {
    return Object.keys(this.offers).length > 0;
  }

  addOffer(peerId, ignoreHandler, acceptHandler) {
    if (this.offers[peerId]) {
      this.offers[peerId].added = new Date();
      return;
    }
    if (this.ignored[peerId]) {
      this.ignored[peerId].added = new Date();
      return;
    }
    const peerName = peerId.substr(0, 5);
    const peer = document.createElement('article');
    peer.added = new Date();
    peer.classList.add('card')
    const section = document.createElement('section');
    section.style.padding = '0.5em';
    peer.append(section);
    const label = document.createElement('label');
    label.textContent = peerName;
    label.classList.add('pseudo', 'button');
    section.append(label);
    const acceptButton = document.createElement('button')
    acceptButton.textContent = 'Connect';
    acceptButton.setAttribute('title', `Connect to ${peerName}`);
    acceptButton.style.float = 'right';
    acceptButton.style.marginLeft = '0.2em';
    acceptButton.addEventListener('click', () => {
      acceptHandler(peerId);
    });
    section.append(acceptButton);
    const ignoreButton = document.createElement('button');
    ignoreButton.textContent = 'Ignore';
    ignoreButton.setAttribute('title', 'Ignore this offer');
    ignoreButton.style.float = 'right';
    ignoreButton.classList.add('warning');
    ignoreButton.addEventListener('click', () => {
      ignoreHandler(peerId);
    });
    section.append(ignoreButton);
    this.offers[peerId] = peer;
    this.panel.append(peer);
    logger.info('Received offer', peerId);
  }

  ignoreOffer(peerId) {
    if (this.ignored[peerId]) {
      this.ignored[peerId].added = new Date();
    } else {
      this.ignored[peerId] = {added: new Date()};
      logger.info('Ignored offer', peerId);
    }
  }

  removeOffer(peerId) {
    if (this.ignored[peerId]) {
      delete this.ignored[peerId];
      logger.info('Removed ignored offer', peerId);
    }
    if (this.offers[peerId]) {
      this.offers[peerId].remove();
      delete this.offers[peerId];
      logger.info('Removed offer', peerId);
    }
  }

  reset() {
    Object.keys(this.offers).forEach(peerId => {
      this.removeOffer(peerId);
    });
  }

  clean() {
    logger.debug('Cleaning expired offers');
    const expired = new Set();
    const now = new Date();
    for (const peerId in this.offers) {
      const diff = now - this.offers[peerId].added;
      if (diff > 60000) {
        expired.add(peerId);
      }
    }
    for (const peerId in this.ignored) {
      const diff = now - this.ignored[peerId].added;
      if (diff > 60000) {
        expired.add(peerId);
      }
    }
    for (const peerId of expired) {
      logger.info('Offer expired', peerId);
      this.removeOffer(peerId);
    }
  }
}
