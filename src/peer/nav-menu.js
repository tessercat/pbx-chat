/*
 * Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 * CC BY-NC-ND 4.0.
 */
export default class NavMenu {

  constructor() {
    this.openHelpButton = this._openHelpButton();
    this.closeConnectionButton = this._closeConnectionButton();
    this.menu = null;
    this.onOpenHelp = () => {};
    this.onCloseConnection = () => {};
  }

  // Object state

  setOffline() {
    this.menu = this.openHelpButton;
  }

  setOnline() {
    this.menu = this.openHelpButton;
  }

  setConnected(clientId) {
    this.closeConnectionButton.clientId = clientId;
    this.menu = this.closeConnectionButton;
  }

  // Protected

  _openHelpButton() {
    const button = document.createElement('button');
    button.textContent = 'Help';
    button.classList.add('pseudo');
    button.setAttribute('title', 'Show troubleshooting help');
    button.addEventListener('click', () => {
      this.onOpenHelp();
    });
    return button;
  }

  _closeConnectionButton() {
    const button = document.createElement('button');
    button.textContent = 'Close';
    button.classList.add('pseudo');
    button.setAttribute('title', 'Close the connection');
    button.addEventListener('click', () => {
      this.onCloseConnection(this.closeConnectionButton.clientId);
    });
    return button;
  }
}
