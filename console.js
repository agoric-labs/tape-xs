/* global trace */

const { freeze } = Object;

export const console = freeze({
  log(...things) {
    const txt = things.map(it => String(it)).join(' ');
    trace(`${txt}\n`);
  },
});
