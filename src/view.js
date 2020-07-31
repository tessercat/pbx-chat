/*
 *  Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 *  CC BY-NC-ND 4.0.
 */
export default class View {

  constructor() {
    this.channelId = document.querySelector("#channelId").value;
    this.clientId = document.querySelector("#clientId").value;
    this.password = document.querySelector("#password").value;
    this.video = document.querySelector("#video");
    this.stream = null;
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
