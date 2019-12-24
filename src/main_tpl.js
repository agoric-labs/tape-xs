/* global Compartment, trace */
import Timer from 'timer';

import tape from 'tape-promise/tape';

const harden = x => Object.freeze(x, true);

const pkg = __PACKAGE__;
const testModules = __TESTMODS__;

export default async function main() {
  trace(`in ${pkg} test/test driver.\n`);

  // trace(JSON.stringify(Object.keys(Compartment.map), null, 2));

  const { setTimeout } = makeTimer(Timer);

  // We use preloading to share tape's main harness.
  const htest = tape.createHarness(pkg);

  const modMap = { ...Compartment.map };
  delete modMap['timer']; // ISSUE: should whitelist
  for (const testModule of testModules) {
    const testing = new Compartment(testModule, { setTimeout }, modMap);
    // trace('built testing compartment\n');
  }

  const summary = await htest.result();
  trace('Result:\n' + JSON.stringify(summary) + '\n');
}


function makeTimer(Timer) {
  return harden({
    setImmediate(callback) {
      Timer.set(callback);
    },
    setTimeout(callback, delay) {
      Timer.set(callback, delay);
    }
  });
}
