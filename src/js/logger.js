/*
 *  Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 *  CC BY-NC-ND 4.0.
 */
function _getPrefix(prefix) {
  return `[${prefix} ${new Date().toLocaleTimeString()}]`;
}

let logger = {
  debug: (prefix, ...args) => {
    if (document.debugLogEnabled) {
      console.debug(_getPrefix(prefix), ...args);
    }
  },
  info: (prefix, ...args) => {
    if (document.infoLogEnabled) {
      console.log(_getPrefix(prefix), ...args);
    }
  },
  error: (prefix, ...args) => {
    console.error(_getPrefix(prefix), ...args);
  }
}
export default logger;
