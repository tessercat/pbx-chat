/*
 * Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 * CC BY-NC-ND 4.0.
 */
export default class NavStatus {

  constructor() {
    this.nameButton = this._nameButton();
    this.peerLabel = this._peerLabel();
    this.menu = null;
    this.onOpen = () => {};
    this.getFullName = () => {return 'N/A'};
    this.getDisplayName = () => {return 'N/A'};
  }

  // Object state

  setIdle() {
    this.menu = this.nameButton;
    this.peerLabel.clientId = null;
  }

  setName(clientId, peerName) {
    this.nameButton.clientId = clientId;
    this.nameButton.peerName = peerName;
    this._initNameButton();
  }

  setConnected(clientId, peerName) {
    this.peerLabel.clientId = clientId;
    this.peerLabel.peerName = peerName;
    this._initPeerLabel();
    this.menu = this.peerLabel;
  }

  isOffering() {
    return this.clientId !== null;
  }

  isOfferTo(clientId) {
    return clientId !== null && clientId === this.clientId;
  }

  // Protected

  _nameButton() {
    const button = document.createElement('button');
    button.classList.add('pseudo');
    window.matchMedia('(min-width: 480px)').addListener(() => {
      this._initNameButton();
    });
    button.addEventListener('click', () => {
      this.onOpen();
    });
    return button;
  }

  _initNameButton() {
    this.nameButton.textContent = this.getDisplayName(
      this.nameButton.clientId, this.nameButton.peerName, 480
    );
    if (this.nameButton.peerName) {
      this.nameButton.setAttribute('title', this.getFullName(
        this.nameButton.clientId, this.nameButton.peerName
      ));
    } else {
      this.nameButton.setAttribute('title', 'Change your name');
    }
  }

  _peerLabel() {
    const label = document.createElement('label');
    label.classList.add('pseudo', 'button');
    window.matchMedia('(min-width: 480px)').addListener(() => {
      if (this.peerLabel.clientId) {
        this._initPeerLabel();
      }
    });
    return label;
  }

  _initPeerLabel() {
    this.peerLabel.textContent = this.getDisplayName(
      this.peerLabel.clientId, this.peerLabel.peerName, 480
    );
    this.peerLabel.setAttribute('title', this.getFullName(
      this.peerLabel.clientId, this.peerLabel.peerName
    ));
  }
}
