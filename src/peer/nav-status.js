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
    this.getDisplayName = () => {'N/A'};
  }

  setClientId(clientId) {
    this.nameButton.peerId = clientId.substr(0, 5);
    this._initNameButton();
  }

  setPeerName(peerName) {
    this.nameButton.peerName = peerName;
    this._initNameButton();
  }

  setIdle() {
    this.menu = this.nameButton;
  }

  setConnected(clientId, peerName) {
    this.peerLabel.peerId = clientId.substr(0, 5);
    this.peerLabel.peerName = peerName;
    this._initPeerLabel();
    this.menu = this.peerLabel;
  }

  _nameButton() {
    const button = document.createElement('button');
    button.classList.add('pseudo');
    window.matchMedia(`(min-width: 480px)`).addListener(() => {
      this._initNameButton();
    });
    button.addEventListener('click', () => {
      this.onOpen();
    });
    return button;
  }

  _initNameButton() {
    if (this.nameButton.peerName) {
      this.nameButton.textContent = this.getDisplayName(
        this.nameButton.peerName, 480
      );
      this.nameButton.setAttribute(
        'title', `${this.nameButton.peerName} (${this.nameButton.peerId})`
      );
    } else {
      this.nameButton.textContent = this.nameButton.peerId;
      this.nameButton.setAttribute('title', 'Click to change your name');
    }
  }

  _peerLabel() {
    const label = document.createElement('label');
    label.classList.add('pseudo', 'button');
    window.matchMedia(`(min-width: 480px)`).addListener(() => {
      this._initPeerLabel();
    });
    return label;
  }

  _initPeerLabel() {
    if (this.peerLabel.peerName) {
      this.peerLabel.textContent = this.getDisplayName(
        this.peerLabel.peerName, 480
      );
      this.peerLabel.setAttribute(
        'title', `${this.peerLabel.peerName} (${this.peerLabel.peerId})`
      );
    } else {
      this.peerLabel.textContent = this.peerLabel.peerId;
      this.peerLabel.removeAttribute('title');
    }
  }
}
