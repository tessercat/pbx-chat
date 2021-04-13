/*
 * Copyright (c) 2021 Peter Christensen. All Rights Reserved.
 * CC BY-NC-ND 4.0.
 */
import VertoClient from '../verto/client.js';
import logger from '../logger.js';

export default class ConferenceClient {

  constructor() {
    this.client = new VertoClient();
  }

  // Public methods

  close() {
    this.client.close();
  }

  open() {
    const sessionId = this.client.getSessionId();
    const url = `${location.href}/session?sessionId=${sessionId}`;
    fetch(url).then(response => {
      if (response.ok) {
        return response.json();
      } else {
        throw new Error(response.status);
      }
    }).then(sessionData => {
      this.client.open(sessionData);
    }).catch(error => {
      if (error.message === '404') {
        const sessionId = this.client.getSessionId(true);
        const url = `${location.href}/session?sessionId=${sessionId}`;
        fetch(url).then(response => {
          if (response.ok) {
            return response.json();
          } else {
            throw new Error(response.status);
          }
        }).then(sessionData => {
          this.client.open(sessionData);
        }).catch(error => {
          logger.error(error);
        });
      } else {
        logger.error(error);
      }
    });
  }
}
