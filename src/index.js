/*
 *  Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 *  CC BY-NC-ND 4.0.
 */
import Client from './client.js';

window.addEventListener('load', function () {
  window.debug = true;
  window.client = new Client();
  window.client.connect();
});
window.addEventListener('beforeunload', function () {
  window.client.disconnect();
  return false;
});
