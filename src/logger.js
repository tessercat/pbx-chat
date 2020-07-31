/*
 *  Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 *  CC BY-NC-ND 4.0.
 */
function identifier() {
  return `[pbx ${new Date().toLocaleTimeString()}]`;
}

let logger = {
  debug: (...args) => {
    if (window.pbxDebugEnabled) {
      console.debug(identifier(), ...args);
    }
  },
  info: (...args) => {
    console.log(identifier(), ...args);
  },
  error: (...args) => {
    console.error(identifier(), ...args);
  }
}
export default logger;
