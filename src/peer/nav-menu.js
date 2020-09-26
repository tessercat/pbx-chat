/*
 * Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 * CC BY-NC-ND 4.0.
 */
export default class NavMenu {

  constructor() {
    this.offlineLabel = this._offlineLabel();
    this.onlineLabel = this._onlineLabel();
    this.closeButton = this._closeButton();
    this.menu = null;
    this.onCloseEvent = () => {};
  }

  setOffline() {
    this.menu = this.offlineLabel;
  }

  setOnline() {
    this.menu = this.onlineLabel;
  }

  setConnected(clientId) {
    this.closeButton.clientId = clientId;
    this.menu = this.closeButton;
  }

  _offlineLabel() {
    const label = document.createElement('label');
    label.textContent = 'Offline';
    label.classList.add('pseudo', 'button');
    return label;
  }

  _onlineLabel() {
    const label = document.createElement('label');
    label.textContent = 'Online';
    label.classList.add('pseudo', 'button');
    return label;
  }

  _closeButton() {
    const button = document.createElement('button');
    button.textContent = 'Close';
    button.classList.add('pseudo');
    button.setAttribute('title', 'Close the connection');
    button.addEventListener('click', () => {
      this.onCloseEvent(this.closeButton.clientId);
    });
    return button;
  }
}
