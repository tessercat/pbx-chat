/*
 *  Copyright (c) 2021 Peter Christensen. All Rights Reserved.
 *  CC BY-NC-ND 4.0.
 */
import adapter from "webrtc-adapter";
import VertoActionClient from './client.js';

document.debugLogEnabled = true;
document.infoLogEnabled = true;

if (adapter.browserDetails.browser.startsWith("Not")) {
  alert("Your browser is not supported.");
} else {
  window.addEventListener('load', function () {
    document.client = new VertoActionClient();
    document.client.open();
  });
  window.addEventListener('beforeunload', function (event) {
    if (document.client && document.client.connected) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
  window.addEventListener('unload', function () {
    document.client.close();
  });
}
