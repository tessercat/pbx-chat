function generateUuid() {
  const url = URL.createObjectURL(new Blob());
  URL.revokeObjectURL(url);
  return url.toString().split('/').pop();
}

export default class Dialog {
  constructor() {
    this.callId = generateUuid();
  }
}
