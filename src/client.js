var WebSocket = require('rpc-websockets').Client

export default class Client {

  constructor() {
    this.ws = null;
    this.keepaliveInterval = 45;
    this.keepaliveId = null;
  }

  log(message, object = null) {
    if (window.debug) {
      console.log(message);
      if (object) {
        console.log(object);
      }
    }
  }

  connect() {
    if (!this.ws) {
      this.ws = new WebSocket(
        `wss://${location.host}${location.pathname}/client`
      );
      this.setHandlers();
      this.keepaliveId = setInterval(() => {
        if (this.ws) {
          this.ws.call('echo', {}).then(result => {
            this.log('echo', result);
          }).catch(error => {
            this.log('echo error', error);
          });
        }
      }, this.keepaliveInterval * 1000);
    }
  }

  setHandlers() {
    this.ws.on('open', (event) => {
      this.log('open', event);
      const params = {'login': 'verto', 'passwd': 'woof'};
      this.ws.call('login', params).then(result => {
        this.log('login', result);
      }).catch(error => {
        this.log('login error', error);
      });
    });
    this.ws.on('close', event =>  {
      this.log('close', event);
    });
    this.ws.on('error', event =>  {
      this.log('error', event);
    });
  }

  disconnect() {
    if (this.keepaliveId) {
      clearInterval(this.keepaliveId);
      this.keepaliveId = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
