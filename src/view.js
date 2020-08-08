/*
 *  Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 *  CC BY-NC-ND 4.0.
 */
import logger from './logger.js';

export default class View {

  constructor() {
    this.actionMenu = new ActionMenu(this);
    this.actionMenu.showPeersAction();
    this.answerDialog = new AnswerDialog(this);
    this.callingDialog = new CallingDialog(this);
    this.peersDialog = new PeersDialog(this);
    this.modalContent = document.querySelector("#modal-content");
    this.modalControl = document.querySelector("#modal-control");
    this.modalOverlay = document.querySelector("#modal-overlay");
    this.channelId = document.querySelector("#channelId").value;
    this.clientId = document.querySelector("#clientId").value;
    this.password = document.querySelector("#password").value;
    this.video = document.querySelector("#video");
    this.stream = null;
  }

  setModalContent(...elements) {
    while (this.modalContent.firstChild) {
      this.modalContent.removeChild(this.modalContent.lastChild);
    }
    for (const element of elements) {
      this.modalContent.append(element);
    }
  }

  showModal() {
    this.modalControl.checked = true;
  }

  hideModal() {
    this.modalControl.checked = false;
  }

  hasPeer(peerId) {
    return this.peersDialog.hasPeer(peerId);
  }

  addPeer(peerId, startCallHandler) {
    if (!this.peersDialog.hasPeer(peerId)) {
      this.peersDialog.addPeer(peerId, startCallHandler);
      logger.info('Added', peerId.substr(0, 5));
    }
  }

  setPeerStatus(peerId, isAvailable) {
    this.peersDialog.setPeerStatus(peerId, isAvailable);
    logger.info('Received', peerId.substr(0, 5), isAvailable);
  }

  removePeer(peerId) {
    this.peersDialog.removePeer(peerId);
  }

  showAnswerDialog(peerId, acceptHandler, rejectHandler) {
    this.answerDialog.show(peerId, acceptHandler, rejectHandler);
  }

  showCallingDialog(peerId, cancelHandler) {
    this.callingDialog.show(peerId, cancelHandler);
  }

  showConnected(hangupHandler) {
    this.hideModal();
    this.actionMenu.showHangupAction(hangupHandler);
  }

  showErrorDialog(error) {
    alert(error);
  }

  setModalDismissable() {
    this.modalControl.disabled = false;
    this.modalOverlay.classList.remove("disabled");
  }

  setModalUndismissable() {
    this.modalControl.disabled = true;
    this.modalOverlay.classList.add("disabled");
  }

  addTrack(track) {
    if (!this.stream) {
      this.stream = new MediaStream();
      this.video.srcObject = this.stream;
    }
    this.stream.addTrack(track);
  }

  removeTracks() {
    if (this.stream) {
      const tracks = this.stream.getTracks();
      for (const track of tracks) {
        this.stream.removeTrack(track);
      }
      this.stream = null
      this.video.srcObject = null;
    }
  }
}

class ActionMenu {

  constructor(view) {
    this.view = view;
    this.menu = document.querySelector("#action-menu");
    this.peersAction = null;
  }

  showPeersAction() {
    if (!this.peersAction) {
      const action = document.createElement("button");
      action.textContent = "Peers";
      action.setAttribute("class", "pseudo");
      action.setAttribute("title", "Show peers list");
      action.addEventListener("click", () => {
        this.view.peersDialog.show();
      });
      this.peersAction = action;
    }
    if (this.menu.firstChild !== this.peersAction) {
      this.menu.removeChild(this.menu.firstChild);
    }
    this.menu.append(this.peersAction);
  }

  showHangupAction(hangupHandler) {
    const action = document.createElement("button");
    action.textContent = "Hang up";
    action.setAttribute("title", "Hang up the call");
    action.addEventListener("click", () => {
      hangupHandler();
    });
    this.menu.removeChild(this.menu.firstChild);
    this.menu.append(action);
  }
}

class PeersDialog {

  constructor(view) {
    this.view = view;
    this.peers = {};
    this.header = null;
    this.section = document.createElement("section");
    this.footer = null;
  }

  hasPeer(peerId) {
    return this.peers[peerId] !== undefined;
  }

  addPeer(peerId, startCallHandler) {
    const peer = {
      button: document.createElement("button"),
      article: document.createElement("article"),
    }
    this.peers[peerId] = peer;
    const label = document.createElement("span");
    label.innerHTML = peerId.substr(0, 5);
    peer.button.textContent = "Call";
    peer.button.setAttribute("class", "dangerous");
    peer.button.setAttribute("title", `Call ${peerId.substr(0, 5)}`);
    peer.button.addEventListener("click", () => {
      startCallHandler(peerId);
    });
    const header = document.createElement("header");
    header.append(label);
    header.append(peer.button);
    peer.article.setAttribute("class", "card")
    peer.article.append(header);
    this.section.append(peer.article);
  }

  setPeerStatus(peerId, isAvailable) {
    const peer = this.peers[peerId];
    if (isAvailable) {
      peer.button.style.display = "inline-block";
    } else {
      peer.button.style.display = "none";
    }
  }

  removePeer(peerId) {
    const peer = this.peers[peerId];
    delete this.peers[peerId];
    if (peer) {
      peer.article.parentNode.removeChild(peer.article);
      logger.info('Removed', peerId.substr(0, 5));
    }
  }

  show() {
    this.view.setModalDismissable();
    if (!this.header) {
      this.header = this._header();
    }
    if (!this.footer) {
      this.footer = this._footer();
    }
    this.view.setModalContent(this.header, this.section, this.footer);
    this.view.showModal();
  }

  _header() {
    const title = document.createElement("h3");
    title.innerHTML = "Peers";

    const label = document.createElement("label");
    label.innerHTML = "&times;";
    label.classList.add("close");
    label.setAttribute("for", "modal-control");

    const header = document.createElement("header");
    header.append(title);
    header.append(label);
    return header;
  }

  _footer() {
    const closeButton = document.createElement("label");
    closeButton.innerHTML = "Close";
    closeButton.classList.add("button");
    closeButton.setAttribute("for", "modal-control");
    closeButton.setAttribute("title", "Close the peer list");

    const footer = document.createElement("footer");
    footer.append(closeButton);
    return footer;
  }
}

class CallingDialog {

  constructor(view) {
    this.view = view;
  }

  show(peerId, cancelHandler) {
    const section = document.createElement("section");
    section.textContent =
      `Calling ${peerId.substr(0, 5)}. Waiting for an answer.`;
    const footer = this._footer(cancelHandler);
    this.view.setModalContent(section, footer);
    this.view.showModal();
  }

  _footer(cancelHandler) {
    const footer = document.createElement("footer");
    const cancelButton = document.createElement("button");
    cancelButton.textContent = "Cancel";
    cancelButton.setAttribute("title", "Cancel the call");
    cancelButton.classList.add("secondary");
    cancelButton.addEventListener("click", () => {
      this.view.hideModal();
      this.actionMenu.showPeersAction();
      cancelHandler();
    });
    footer.append(cancelButton);
    return footer;
  }
}

class AnswerDialog {

  constructor(view) {
    this.view = view;
  }

  show(peerId, acceptHandler, rejectHandler) {
    const section = document.createElement("section");
    section.textContent = `Ringing. ${peerId.substr(0, 5)} is calling.`
    const footer = this._footer(peerId, acceptHandler, rejectHandler);
    this.view.setModalContent(section, footer);
    this.view.showModal();
  }

  _footer(peerId, acceptHandler, rejectHandler) {
    const footer = document.createElement("footer");
    const answerButton = document.createElement("button");
    answerButton.textContent = "Answer";
    answerButton.setAttribute("title", "Answer the call");
    answerButton.addEventListener("click", () => {
      this.view.hideModal();
      acceptHandler(peerId);
    });
    footer.append(answerButton);

    const rejectButton = document.createElement("button");
    rejectButton.textContent = "Reject";
    rejectButton.setAttribute("title", "Reject the call");
    rejectButton.classList.add("secondary");
    rejectButton.addEventListener("click", () => {
      this.view.hideModal();
      rejectHandler();
    });
    footer.append(rejectButton);

    return footer;
  }
}
