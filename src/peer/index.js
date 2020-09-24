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
    document.debugLogEnabled = false;
    document.clientLogEnabled = true;
    document.infoLogEnabled = true;
    document.peer = new Peer();
    document.peer.connect();
  });
  window.addEventListener('beforeunload', function (event) {
    if (!document.peer.connection.isIdle()) {
      event.preventDefault();
      event.returnValue = '';
    } else {
      document.peer.disconnect();
    }
  });
  window.addEventListener('unload', function () {
    document.peer.disconnect();
  });
}
