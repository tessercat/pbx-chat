/*
 *  Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 *  CC BY-NC-ND 4.0.
 *
 * This class provides an interface for a JavaScript application
 * to interact with the page served by the call control and
 * application server.
 */
export default class View {

  constructor() {
    this.channelId = document.querySelector("#channelId").value;
    this.clientId = document.querySelector("#clientId").value;
    this.password = document.querySelector("#password").value;
    this._navMenu = document.querySelector("#nav-menu");
    this._navStatus = document.querySelector("#nav-status");
    this._modalContent = document.querySelector("#modal-content");
    this._modalControl = document.querySelector("#modal-control");
    this._modalOverlay = document.querySelector("#modal-overlay");
    this._videoElement = document.querySelector("#video");
  }

  // Content management methods.

  setStatusMessage(message) {
    this._navStatus.textContent = message;
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
    alert(message);
  }

  getModalHeader(title, hasCloseControl = true) {
    const heading = document.createElement("h3");
    heading.textContent = title;
    const header = document.createElement("header");
    header.append(heading);
    if (hasCloseControl) {
      const label = document.createElement("label");
      label.innerHTML = "&times;";
      label.classList.add("close");
      label.setAttribute("for", "modal-control");
      header.append(label);
    }
    return header;
  }

  showModal(disableControl = false) {
    this._modalControl.checked = true;
    if (disableControl) {
      this._modalControl.disabled = true;
      this._modalOverlay.classList.add("disabled");
    } else {
      this._modalControl.disabled = false;
      this._modalOverlay.classList.remove("disabled");
    }
  }

  hideModal() {
    this._modalControl.checked = false;
  }

  isModalShown() {
    return this._modalControl.checked;
  }

  // Track mangement methods.

  addTrack(track) {
    if (!this._videoElement.srcObject) {
      this._videoElement.srcObject = new MediaStream();
    }
    this._videoElement.srcObject.addTrack(track);
  }

  removeTracks() {
    if (this._videoElement.srcObject) {
      for (const track of this._videoElement.srcObject.getTracks()) {
        track.stop();
      }
      this._videoElement.srcObject = null;
    }
  }
}
