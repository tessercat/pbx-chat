/*
 *  Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 *  CC BY-NC-ND 4.0.
 */
//import {debug} from './logger.js';

export default class View {
  constructor(peer) {
    this.peer = peer;
    this.clientId = document.querySelector("#clientId").value;
    this.channelId = document.querySelector("#channelId").value;
  }
}
