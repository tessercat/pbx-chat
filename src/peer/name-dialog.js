/*
 * Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 * CC BY-NC-ND 4.0.
 */
export default class NameDialog {

  constructor(header) {
    this.peerId = null;
    this.peerName = '';
    this.section = this._section();
    this.footer = this._footer();
    this.modalContent = [header, this.section, this.footer];
    this.nameField = this.section.querySelector('#name-input');
    this.okButton = this.footer.querySelector('#name-ok');
    this.nameFieldValidator = new RegExp('^[a-zA-Z0-9]+( [a-zA-Z0-9]+)*$');
    this._addListeners();
    this.onSubmit = () => {};
    this.onClose = () => {};
  }

  // Static validation helpers

  getValid(peerName) {
    if (!peerName || !this.isValid(peerName)) {
      return '';
    }
    return peerName;
  }

  isValid(peerName) {
    if (this.nameFieldValidator.test(peerName) && peerName.length <= 32) {
      return true;
    }
    return false;
  }

  // Object state

  setName(clientId, peerName) {
    this.peerId = clientId.substr(0, 5);
    if (peerName && this.isValid(peerName)) {
      this.peerName = peerName;
      this.nameField.value = peerName;
    } else {
      this.peerName = '';
      this.nameField.value = this.peerId;
    }
    this.nameField.setCustomValidity('');
  }

  onModalVisible() {
    this.nameField.focus();
    this.nameField.select();
  }

  // Protected

  _setPeerName() {
    if (this.nameField.value === this.peerId) {
      this.peerName = '';
    } else if (!this.nameField.value) {
      this.nameField.value = this.peerId;
      this.peerName = '';
    } else {
      this.peerName = this.nameField.value;
    }
  }

  _addListeners() {
    this.nameField.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && this.nameField.validity.valid) {
        this._setPeerName();
        this.onSubmit();
      }
    });
    this.nameField.addEventListener('input', () => {
      if (this.nameField.value === '') {
        this.nameField.setCustomValidity('');
        this.okButton.disabled = false;
      } else if (this.nameField.value === this.peerId) {
        this.nameField.setCustomValidity('')
        this.okButton.disabled = false;
      } else if (this.isValid(this.nameField.value)) {
        this.nameField.setCustomValidity('');
        this.okButton.disabled = false;
      } else {
        this.nameField.setCustomValidity('Up to 32 letters and spaces.');
        this.okButton.disabled = true;
      }
    });
  }

  _section() {
    const input = document.createElement('input');
    input.setAttribute('type', 'text');
    input.setAttribute('id', 'name-input');
    const section = document.createElement('section');
    section.append(input);
    return section;
  }

  _footer() {
    const okButton = document.createElement('button');
    okButton.setAttribute('id', 'name-ok');
    okButton.setAttribute('title', 'Change your name');
    okButton.textContent = 'OK';
    okButton.style.float = 'right';
    okButton.addEventListener('click', () => {
      this._setPeerName();
      this.onSubmit();
    });
    const closeButton = document.createElement('button');
    closeButton.classList.add('pseudo');
    closeButton.setAttribute('title', 'Close this popup');
    closeButton.textContent = 'Close';
    closeButton.addEventListener('click', () => {
      this.onClose();
    });
    const footer = document.createElement('footer');
    footer.append(okButton);
    footer.append(closeButton);
    return footer;
  }
}
