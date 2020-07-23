/*
 *  Copyright (c) 2020 Peter Christensen. All Rights Reserved.
 *  CC BY-NC-ND 4.0.
 */
export const debug = (...args) => {
  if (window.debug) {
    console.debug('[pbx]', ...args);
  }
}

export const info = (...args) => {
  console.log('[pbx]', ...args);
}

export const error = (...args) => {
  console.error('[pbx]', ...args);
}
