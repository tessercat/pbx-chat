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
    this.header = view.getModalHeader('Alert');
    this.body = this._messagePanel();
    this.footer = this._footer(view);
    this.messageDiv = this.body.querySelector('#alert-message');
    this.isActive = false;
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
      this.isActive = false;
      view.modalControl.checked = false;
      if (
          this.oldModal
          && this.oldModal.hasContent
          && this.oldModal.hasContent()) {
        view.showModal(this.oldModal);
        this.oldModal = null;
      }
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
    this.channelInfoPanel = document.querySelector('#channel-info');
    this.modalContent = document.querySelector('#modal-content');
    this.modalControl = document.querySelector('#modal-control');
    this.modalOverlay = document.querySelector('#modal-overlay');
    this.videoElement = document.querySelector('#media-player');
    this.activityWatcher = new ActivityWatcher(this.navBar);
    this.alertModal = new AlertModal(this);
    this.modal = null;
  }

  _setContent(container, ...elements) {
    while (container.firstChild) {
      container.firstChild.remove();
    }
    for (const element of elements) {
      container.append(element);
    }
  }

  _setModalContent(modal) {
    if (modal.enableCloseControl) {
      this.modalControl.disabled = false;
      this.modalOverlay.classList.remove('disabled');
    } else {
      this.modalControl.disabled = true;
      this.modalOverlay.classList.add('disabled');
    }
    this._setContent(this.modalContent, ...modal.getContent());
  }

  addTrack(track) {
    if (!this.videoElement.srcObject) {
      this.videoElement.srcObject = new MediaStream();
    }
    this.videoElement.srcObject.addTrack(track);
  }

  showPlayer() {
    this.activityWatcher.startWatching();
    this.videoElement.style.display = 'unset';
    this.channelInfoPanel.style.display = 'none';
  }

  hidePlayer() {
    this.activityWatcher.stopWatching();
    if (this.videoElement.srcObject) {
      for (const track of this.videoElement.srcObject.getTracks()) {
        track.stop();
      }
      this.videoElement.srcObject = null;
    }
    this.videoElement.style.display = 'none';
    this.channelInfoPanel.style.display = 'unset';
  }

  setNavStatus(message) {
    if (!this.navStatusLabel) {
      this.navStatusLabel = document.createElement('label');
      this.navStatusLabel.classList.add('pseudo', 'button');
      this._setContent(this.navStatus, this.navStatusLabel);
    }
    this.navStatusLabel.textContent = message;
  }

  setNavMenuContent(...elements) {
    this._setContent(this.navMenu, ...elements);
  }

  setChannelInfoContent(...elements) {
    this._setContent(this.channelInfoPanel, ...elements);
  }

  getModalHeader(title, enableCloseControl = false) {
    const heading = document.createElement('h3');
    heading.textContent = title;
    const header = document.createElement('header');
    header.append(heading);
    if (enableCloseControl) {
      const label = document.createElement('label');
      label.innerHTML = '&times;';
      label.classList.add('close');
      label.setAttribute('for', 'modal-control');
      header.append(label);
    }
    return header;
  }

  showAlert(message) {
    this.alertModal.setMessage(message);
    this.alertModal.isActive = true;
    this.alertModal.oldModal = this.modal;
    this.modal = null;
    this._setModalContent(this.alertModal);
    this.modalControl.checked = true;
  }

  showModal(modal) {
    if (!this.alertModal.isActive && modal !== this.modal) {
      this.modal = modal;
      this._setModalContent(modal);
      this.modalControl.checked = true;
    }
  }

  hideModal() {
    if (!this.alertModal.isActive) {
      this.modal = null;
      this.modalControl.checked = false;
    }
  }
}
