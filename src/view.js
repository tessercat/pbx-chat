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

  constructor(header) {
    this.header = header;
    this.body = this._messagePanel();
    this.footer = this._footer();
    this.modalContent = [this.header, this.body, this.footer];
    this.messageDiv = this.body.querySelector('#alert-message');
    this.message = null;
    this.onClose = () => {};
  }

  _messagePanel() {
    const section = document.createElement('section');
    const message = document.createElement('div');
    message.setAttribute('id', 'alert-message');
    message.style.textAlign = 'center';
    section.append(message);
    return section;
  }

  _footer() {
    const button = document.createElement('button');
    button.textContent = 'OK';
    button.setAttribute('title', 'Acknowledge this alert');
    button.style.float = 'right';
    button.addEventListener('click', () => {
      this.onClose();
    });
    const footer = document.createElement('footer');
    footer.append(button);
    return footer;
  }

  isActive() {
    return this.message !== null;
  }

  setMessage(message) {
    this.message = message;
    this.messageDiv.textContent = message;
  }
}

export default class View {

  constructor() {
    this.navBar = document.querySelector('#nav-bar');
    this.activityWatcher = new ActivityWatcher(this.navBar);
    this.navMenu = document.querySelector('#nav-menu');
    this.navStatus = document.querySelector('#nav-status');
    this.channelInfoPanel = document.querySelector('#channel-info');
    this.modalContent = document.querySelector('#modal-content');
    this.modalControl = document.querySelector('#modal-control');
    this.modalOverlay = document.querySelector('#modal-overlay');
    this.videoElement = document.querySelector('#media-player');
    this._addEscapeListener();
    this.alertModal = new AlertModal(
      this.modalHeader('Alert')
    );
    this.alertModal.onClose = this._onCloseAlert.bind(this)
    this.modal = null;
    this.oldModal = null;
  }

  _addEscapeListener() {
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (this.modal && this.modal.onModalEscape) {
          this.modal.onModalEscape();
        } else if (this.alertModal.isActive()) {
          this._onCloseAlert();
        }
      }
    });
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
    this._setContent(this.modalContent, ...modal.modalContent);
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

  setNavStatus(...elements) {
    this._setContent(this.navStatus, ...elements);
  }

  setNavMenu(...elements) {
    this._setContent(this.navMenu, ...elements);
  }

  setChannelInfo(...elements) {
    this._setContent(this.channelInfoPanel, ...elements);
  }

  modalHeader(title, enableCloseControl = false) {
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

  /*
   * Showing an alert message hides the existing modal, if any. The hidden
   * modal is permanently hidden and doesn't re-appear when the alert is
   * dismissed unless the hidden modal has a hasModalContent method that
   * returns something truthy.
   */

  showAlert(message) {
    this.alertModal.setMessage(message);
    this.oldModal = this.modal;
    this.modal = null;
    this._setModalContent(this.alertModal);
    this.modalControl.checked = true;
  }

  _onCloseAlert() {
    this.alertModal.message = null;
    if (this.oldModal) {
      this.modal = this.oldModal;
      this.oldModal = null;
      if (this.modal.hasModalContent && this.modal.hasModalContent()) {
        this._setModalContent(this.modal);
      } else {
        this.modal = null;
        this.modalControl.checked = false;
      }
    } else {
      this.modalControl.checked = false;
    }
  }

  /*
   * Showing a modal while the alert is active leaves the alert active and
   * replaces/sets the hidden modal, if any.
   */

  showModal(modal) {
    if (!modal || !modal.modalContent) {
      return
    }
    if (modal.hasModalContent && !modal.hasModalContent()) {
      return;
    }
    if (this.alertModal.isActive()) {
      if (modal !== this.oldModal) {
        this.oldModal = modal;
      }
    } else {
      if (modal === this.modal) {
        this.modalControl.checked = true;
      } else {
        this.modal = modal;
        this._setModalContent(modal);
        this.modalControl.checked = true;
        if (this.modal.onModalVisible) {
          this.modal.onModalVisible();
        }
      }
    }
  }

  /*
   * Hiding the modal requires a reference to the currently displayed
   * modal, or, if the alert is active, to the hidden modal. Otherwise the
   * command is ignored.
   */

  hideModal(modal) {
    if (!modal) {
      return;
    }
    if (this.alertModal.isActive()) {
      if (modal === this.oldModal) {
        this.oldModal = null;
      }
    } else {
      if (modal === this.modal) {
        this.modal = null;
        this.modalControl.checked = false;
      }
    }
  }
}
