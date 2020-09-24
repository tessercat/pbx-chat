/*
 * Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 * CC BY-NC-ND 4.0.
 */
import logger from '../logger.js';

export default class OffersDialog {

  constructor(header) {
    this.header = header;
    this.panel = document.createElement('section');
    this.footer = document.createElement('footer');
    this.modalContent = [this.header, this.panel, this.footer];
    this.offers = {};
    this.ignored = {};
    this.onAccept = () => {};
    this.onIgnore = () => {};
    this.displayName = () => {return 'N/A'};
  }

  _setPeerName(offer) {
    offer.label.textContent = this.displayName(
      offer.clientId, offer.peerName, 480
    );
    if (offer.peerName) {
      offer.ignoreButton.setAttribute(
        'title', `Ignore offer from ${offer.peerName} (${offer.peerId})`
      );
      offer.acceptButton.setAttribute(
        'title', `Accept offer from ${offer.peerName} (${offer.peerId})`
      );
      offer.label.setAttribute(
        'title', `${offer.peerName} (${offer.peerId})`
      );
    } else {
      offer.ignoreButton.setAttribute(
        'title', `Ignore offer from ${offer.peerId}`
      );
      offer.acceptButton.setAttribute(
        'title', `Accept offer from ${offer.peerId}`
      );
      offer.label.removeAttribute('title');
    }
  }

  addOffer(clientId, peerName) {
    if (this.offers[clientId]) {
      this.offers[clientId].added = new Date();
      if (peerName !== this.offers[clientId].peerName) {
        this.offers[clientId].peerName = peerName;
        this._setPeerName(this.offers[clientId]);
      }
      return;
    }
    if (this.ignored[clientId]) {
      this.ignored[clientId].added = new Date();
      return;
    }
    const offer = document.createElement('article');
    offer.classList.add('card')
    const section = document.createElement('section');
    section.style.padding = '0.5em';
    offer.append(section);
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
      this.onAccept(clientId, this.offers[clientId].peerName);
    });
    section.append(acceptButton);
    const ignoreButton = document.createElement('button');
    ignoreButton.textContent = 'Ignore';
    ignoreButton.setAttribute('title', 'Ignore this offer');
    ignoreButton.style.float = 'right';
    ignoreButton.classList.add('warning');
    ignoreButton.addEventListener('click', () => {
      this.onIgnore(clientId);
    });
    section.append(ignoreButton);
    offer.added = new Date();
    offer.clientId = clientId;
    offer.peerName = peerName;
    offer.peerId = this.displayName(clientId);
    offer.ignoreButton = ignoreButton;
    offer.acceptButton = acceptButton;
    offer.label = label;
    this.offers[clientId] = offer;
    this._setPeerName(offer);
    this.panel.append(offer);
    logger.info('Received offer', clientId);
  }

  ignoreOffer(clientId) {
    if (this.ignored[clientId]) {
      this.ignored[clientId].added = new Date();
    } else {
      this.ignored[clientId] = {added: new Date()};
      logger.info('Ignored offer', clientId);
    }
  }

  removeOffer(clientId) {
    if (this.ignored[clientId]) {
      delete this.ignored[clientId];
      logger.info('Removed ignored offer', clientId);
    }
    if (this.offers[clientId]) {
      this.offers[clientId].remove();
      delete this.offers[clientId];
      logger.info('Removed offer', clientId);
    }
  }

  reset() {
    Object.keys(this.offers).forEach(clientId => {
      this.removeOffer(clientId);
    });
  }

  clean() {
    logger.debug('Cleaning expired offers');
    const expired = new Set();
    const now = new Date();
    for (const clientId in this.offers) {
      const diff = now - this.offers[clientId].added;
      if (diff > 60000) {
        expired.add(clientId);
      }
    }
    for (const clientId in this.ignored) {
      const diff = now - this.ignored[clientId].added;
      if (diff > 60000) {
        expired.add(clientId);
      }
    }
    for (const clientId of expired) {
      logger.info('Offer expired', clientId);
      this.removeOffer(clientId);
    }
  }
}
