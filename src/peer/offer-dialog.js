/*
 * Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 * CC BY-NC-ND 4.0.
 */
export default class OfferDialog {

  constructor() {
    this.section = document.createElement('section');
    this.footer = this._footer();
    this.modalContent = [this.section, this.footer];
    this.clientId = null;
    this.peerName = null;
    this.onCancel = () => {};
  }

  // Object state

  setInitializing() {
    this.clientId = null;
    this.section.textContent = 'Starting local media.';
  }

  setOffering(clientId, peerName) {
    this.clientId = clientId;
    this.peerName = peerName;
    this.section.textContent = (
      `Offer sent. Waiting for ${this.peerName} to accept.`
    );
  }

  setClosed(message) {
    this.clientId = null;
    if (message) {
      this.section.textContent = `${this.peerName} ${message}.`;
    }
  }

  isOffering() {
    return this.clientId !== null;
  }

  isOfferTo(clientId) {
    return clientId !== null && clientId === this.clientId;
  }

  // Protected

  _footer() {
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.setAttribute('title', 'Cancel the offer');
    cancelButton.style.float = 'right';
    cancelButton.addEventListener('click', () => {
      this.onCancel();
    });
    const footer = document.createElement('footer');
    footer.append(cancelButton);
    return footer;
  }
}
