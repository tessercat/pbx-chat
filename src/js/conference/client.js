/*
 * Copyright (c) 2021 Peter Christensen. All Rights Reserved.
 * CC BY-NC-ND 4.0.
 */
import VertoClient from '../verto/client.js';
//import logger from '../logger.js';

export default class ConferenceClient {

  constructor() {
    this.client = new VertoClient();
    this.client.getSessionData = this._getSessionData.bind(this)
  }

  open() {
    this.client.open();
  }

  close() {
    this.client.close();
  }

  _getSessionData(sessionId, onSuccess, onError) {
    const url = `${location.href}/session?sessionId=${sessionId}`;
    fetch(url).then(response => {
      if (response.ok) {
        return response.json();
      } else {
        throw new Error(response);
      }
    }).then(sessionData => {
      onSuccess(sessionData);
    }).catch(error => {
      onError(error);
    });
  }
}
