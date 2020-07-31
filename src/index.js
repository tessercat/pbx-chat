/*
 *  Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 *  CC BY-NC-ND 4.0.
 */
import adapter from "webrtc-adapter";
import Client from './client.js';

if (adapter.browserDetails.browser.startsWith("Not")) {
  alert("Your browser is not supported.");
} else {
  window.addEventListener('load', function () {
    window.client = new Client();
    window.client.connect();
  });
  window.addEventListener('beforeunload', function () {
    window.client.disconnect();
    return false;
  });
}
