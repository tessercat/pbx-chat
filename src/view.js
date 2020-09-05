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
    button.textContent = 'OK';
    button.setAttribute('title', 'Acknowledge this alert');
    button.style.float = 'right';
    button.addEventListener('click', () => {
      view.isAlertActive = false;
      view.modalControl.checked = false;
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
    this.navBar = document.querySelector('#nav-bar');
    this.navMenu = document.querySelector('#nav-menu');
    this.navStatus = document.querySelector('#nav-status');
    this.alertModal = new AlertModal(this);
    this.isAlertActive = false;
    this.modalContent = document.querySelector('#modal-content');
    this.modalControl = document.querySelector('#modal-control');
    this.modalOverlay = document.querySelector('#modal-overlay');
    this.videoElement = document.querySelector('#video');
    this.videoElement.style.display = 'unset';
    this.defaultBackgroundColor = this.videoElement.style.backgroundColor;
    this.activityWatcher = new ActivityWatcher(this.navBar);
  }

  addTrack(track) {
    if (!this.videoElement.srcObject) {
      this.videoElement.srcObject = new MediaStream();
    }
    this.videoElement.srcObject.addTrack(track);
  }

  startVideo() {
    this.activityWatcher.startWatching();
    this.videoElement.style.objectFit = 'contain';
    this.videoElement.style.backgroundColor = 'black';
  }

  stopVideo() {
    this.activityWatcher.stopWatching();
    if (this.videoElement.srcObject) {
      for (const track of this.videoElement.srcObject.getTracks()) {
        track.stop();
      }
      this.videoElement.srcObject = null;
    }
    this.videoElement.style.objectFit = 'cover';
    this.videoElement.style.backgroundColor = this.defaultBackgroundColor;
  }

  setNavStatus(message) {
    if (!this.navStatusLabel) {
      this.navStatusLabel = document.createElement('label');
      this.navStatusLabel.classList.add('pseudo');
      this._setContent(this.navStatus, this.navStatusLabel);
    }
    this.navStatusLabel.textContent = message;
  }

  setNavMenuContent(...elements) {
    this._setContent(this.navMenu, ...elements);
  }

  setModalContent(...elements) {
    this._setContent(this.modalContent, ...elements);
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
    this.isAlertActive = true;
    this.alertModal.setMessage(message);
    this._oldModalContent = [...this.modalContent.children];
    this.setModalContent(...this.alertModal.getContent());
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
    this.modalControl.checked = true;
    if (disableControl) {
      this.modalControl.disabled = true;
      this.modalOverlay.classList.add('disabled');
    } else {
      this.modalControl.disabled = false;
      this.modalOverlay.classList.remove('disabled');
    }
  }

  hideModal() {
    if (!this.isAlertActive) {
      this.modalControl.checked = false;
    }
  }

  isModalVisible() {
    return this.modalControl.checked;
  }
}
