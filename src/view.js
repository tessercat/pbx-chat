/*
 *  Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 *  CC BY-NC-ND 4.0.
 */
class ActivityWatcher {

  constructor(...elements) {
    this.elements = elements;
    this.activityEvents = ['mousemove', 'touchstart'];
    this.expired = 0;
    this.interval = 1000;
    this.intervalId = null;
    this.maxInactivity = 4000;
    this.isVisible = true;
  }

  _hideElements() {
    this.isVisible = false;
    this.elements.forEach((element) => {
      element.style.visibility = 'hidden';
    });
  }

  _showElements() {
    this.isVisible = true;
    this.elements.forEach((element) => {
      element.style.visibility = 'visible';
    });
  }

  _onActivity() {
    this.expired = 0;
    if (!this.isVisible) {
      this._showElements();
    }
  }

  startWatching() {
    if (!this.intervalId) {
      this.intervalId = setInterval(() => {
        this.expired += this.interval;
        if (this.isVisible && this.expired > this.maxInactivity) {
          this._hideElements();
        }
      }, this.interval);
      this.activityEvents.forEach((eventType) => {
        document.addEventListener(eventType, this._onActivity.bind(this));
      });
    }
  }

  stopWatching() {
    this.activityEvents.forEach((eventType) => {
      document.removeEventListener(eventType, this._onActivity);
    });
    clearInterval(this.intervalId);
    this.intervalId = null;
    if (!this.isVisible) {
      this._showElements();
    }
  }
}

class AlertModal {

  constructor(view) {
    this.header = view.getModalHeader('Alert', false);
    this.body = this._messagePanel();
    this.footer = this._footer(view);
    this.messageDiv = this.body.querySelector('#alert-message');
  }

  _messagePanel() {
    const section = document.createElement('section');
    const message = document.createElement('div');
    message.setAttribute('id', 'alert-message');
    message.style.textAlign = 'center';
    section.append(message);
    return section;
  }

  _footer(view) {
    const button = document.createElement('button');
    button.textContent = 'Close';
    button.setAttribute('title', 'Close this alert');
    button.style.float = 'right';
    button.addEventListener('click', () => {
      view.hideModal();
      view.setModalContent(...view._oldModalContent);
    });
    const footer = document.createElement('footer');
    footer.append(button);
    return footer;
  }

  getContent() {
    return [this.header, this.body, this.footer];
  }

  setMessage(message) {
    this.messageDiv.textContent = message;
  }
}

export default class View {

  constructor() {
    this.channelId = document.querySelector('#channelId').value;
    this.clientId = document.querySelector('#clientId').value;
    this.password = document.querySelector('#password').value;
    this._navBar = document.querySelector('#nav-bar');
    this._navMenu = document.querySelector('#nav-menu');
    this._navStatus = document.querySelector('#nav-status');
    this._alertModal = new AlertModal(this);
    this._modalContent = document.querySelector('#modal-content');
    this._modalControl = document.querySelector('#modal-control');
    this._modalOverlay = document.querySelector('#modal-overlay');
    this._videoElement = document.querySelector('#video');
    this._videoElement.style.display = 'unset';
    this._defaultBackgroundColor = this._videoElement.style.backgroundColor;
    this._activityWatcher = new ActivityWatcher(this._navBar);
  }

  // Content management methods.

  addTrack(track) {
    if (!this._videoElement.srcObject) {
      this._videoElement.srcObject = new MediaStream();
    }
    this._videoElement.srcObject.addTrack(track);
  }

  startVideo() {
    this._activityWatcher.startWatching();
    this._videoElement.style.objectFit = 'contain';
    this._videoElement.style.backgroundColor = 'black';
  }

  stopVideo() {
    this._activityWatcher.stopWatching();
    if (this._videoElement.srcObject) {
      for (const track of this._videoElement.srcObject.getTracks()) {
        track.stop();
      }
      this._videoElement.srcObject = null;
    }
    this._videoElement.style.objectFit = 'cover';
    this._videoElement.style.backgroundColor = this._defaultBackgroundColor;
  }

  setNavStatus(message) {
    if (!this.navStatusLabel) {
      this.navStatusLabel = document.createElement('label');
      this.navStatusLabel.classList.add('pseudo');
      this._setContent(this._navStatus, this.navStatusLabel);
    }
    this.navStatusLabel.textContent = message;
  }

  setNavMenuContent(...elements) {
    this._setContent(this._navMenu, ...elements);
  }

  setModalContent(...elements) {
    this._setContent(this._modalContent, ...elements);
  }

  _setContent(container, ...elements) {
    while (container.firstChild) {
      container.firstChild.remove();
    }
    for (const element of elements) {
      container.append(element);
    }
  }

  showAlert(message) {
    this._alertModal.setMessage(message);
    this._oldModalContent = [...this._modalContent.children];
    this.setModalContent(...this._alertModal.getContent());
    this.showModal(true);
  }

  getModalHeader(title, hasCloseControl = true) {
    const heading = document.createElement('h3');
    heading.textContent = title;
    const header = document.createElement('header');
    header.append(heading);
    if (hasCloseControl) {
      const label = document.createElement('label');
      label.innerHTML = '&times;';
      label.classList.add('close');
      label.setAttribute('for', 'modal-control');
      header.append(label);
    }
    return header;
  }

  showModal(disableControl = false) {
    this._modalControl.checked = true;
    if (disableControl) {
      this._modalControl.disabled = true;
      this._modalOverlay.classList.add('disabled');
    } else {
      this._modalControl.disabled = false;
      this._modalOverlay.classList.remove('disabled');
    }
  }

  hideModal() {
    this._modalControl.checked = false;
  }

  isModalVisible() {
    return this._modalControl.checked;
  }
}
