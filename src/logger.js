/*
 *  Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 *  CC BY-NC-ND 4.0.
 */
function identifier() {
  return `[pbx ${new Date().toLocaleTimeString()}]`;
}

export const debug = (...args) => {
  if (window.debug) {
    console.debug(identifier(), ...args);
  }
}

export const info = (...args) => {
  console.log(identifier(), ...args);
}

export const error = (...args) => {
  console.error(identifier(), ...args);
}
