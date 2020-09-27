/*
 * Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 * CC BY-NC-ND 4.0.
 */
const HELP_TEXT = [
  'Your device must have both a camera and a microphone '
  + 'installed and enabled. '
  + 'Make sure the browser has permission to use them.',
  'Check volume levels.',
  'Poor wireless is often the cause of poor quality calls.',
  'Connections fail when firewalls get in the way. '
  + 'Use a VPN when connecting from restrictive networks.',
  'Otherwise, the service should work between '
  + 'Firefox and Chromium-based browsers '
  + 'on Android, Windows and Linux. '
  + 'It hasn\'t been tested on appleOS.'
]

export default class NameDialog {

  constructor(header) {
    this.section = this._section();
    this.footer = this._footer();
    this.modalContent = [header, this.section, this.footer];
    this.onClose = () => {};
  }

  _section() {
    const section = document.createElement('section');
    HELP_TEXT.forEach((line) => {
      const p = document.createElement('p');
      p.innerHTML = line;
      section.append(p);
    });
    return section;
  }

  _footer() {
    const closeButton = document.createElement('button');
    closeButton.setAttribute('title', 'Close this box');
    closeButton.textContent = 'Close';
    closeButton.style.float = 'right';
    closeButton.addEventListener('click', () => {
      this.onClose();
    });
    const footer = document.createElement('footer');
    footer.append(closeButton);
    return footer;
  }
}
