/*
 * Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 * CC BY-NC-ND 4.0.
 */
export default class NameDialog {

  constructor(header) {
    this.peerId = null;
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

  setClientId(clientId) {
    this.peerId = clientId.substr(0, 5);
  }

  init(peerName) {
    this.nameField.value = peerName ? peerName : this.peerId;
    this.nameField.setCustomValidity('');
  }

  isValid(peerName) {
    if (this.nameFieldValidator.test(peerName) && peerName.length <= 32) {
      return true;
    }
    return false;
  }

  setFocus() {
    this.nameField.focus();
    this.nameField.select();
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
      this._submit();
    });
    const closeButton = document.createElement('button');
    closeButton.setAttribute('title', 'Close this popup');
    closeButton.style.background = '#888';
    closeButton.textContent = 'Close';
    closeButton.addEventListener('click', () => {
      this.onClose();
    });
    const footer = document.createElement('footer');
    footer.append(okButton);
    footer.append(closeButton);
    return footer;
  }

  _addListeners() {
    this.nameField.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && this.nameField.validity.valid) {
        this._submit(this.onSubmit);
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

  _submit() {
    if (this.nameField.value === this.peerId) {
      this.onSubmit('');
    } else {
      this.onSubmit(this.nameField.value);
    }
  }
}
