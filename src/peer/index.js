/*
 *  Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 *  CC BY-NC-ND 4.0.
 */
import adapter from "webrtc-adapter";
import Peer from './peer.js';

if (adapter.browserDetails.browser.startsWith("Not")) {
  alert("Your browser is not supported.");
} else {
  window.addEventListener('load', function () {
    window.peer = new Peer();
    window.peer.connect();
  });
  window.addEventListener('beforeunload', function (event) {
    if (window.peer) {
      if (window.peer.hasConnectedPeer()) {
        event.preventDefault();
        event.returnValue = '';
      } else {
        window.peer.disconnect();
      }
    }
  });
}
