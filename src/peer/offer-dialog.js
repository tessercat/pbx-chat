/*
 * Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 * CC BY-NC-ND 4.0.
 */
import logger from '../logger.js';

export default class ConnectDialog {

  constructor(closeHandler) {
    this.section = document.createElement('section');
    this.footer = this._footer(closeHandler);
    this.offerId = null;
  }

  _footer(cancelHandler) {
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.setAttribute('title', 'Cancel the offer');
    cancelButton.style.float = 'right';
    cancelButton.addEventListener('click', () => {
      cancelHandler();
    });
    const footer = document.createElement('footer');
    footer.append(cancelButton);
    return footer;
  }

  getContent() {
    return [this.section, this.footer];
  }

  isOffering() {
    return this.offerId !== null;
  }

  isOfferTo(peerId) {
    return peerId !== null && peerId === this.offerId;
  }

  setInitializing() {
    this.offerId = null;
    this.section.textContent = 'Starting local media.';
  }

  setOffering(peerId) {
    this.offerId = peerId;
    this.section.textContent = 'Offer sent. Waiting for a reply.';
  }

  setClosed(message) {
    this.offerId = null;
    if (message) {
      this.section.textContent = message;
      logger.info(message);
    }
  }
}
