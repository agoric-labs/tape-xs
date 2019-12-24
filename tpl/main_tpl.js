/* global Compartment, trace */
import Timer from 'timer';

import tape from 'tape-promise/tape';

import { makeConsole } from 'xs-platform/console';

const harden = x => Object.freeze(x, true);

const pkg = __PACKAGE__;
const testModules = __TESTMODS__;

export default async function main() {
  const console = makeConsole();
  console.log(`in ${pkg} driver...`);

  // trace(JSON.stringify(Object.keys(Compartment.map), null, 2));

  const { setTimeout } = makeTimer(Timer);

  // We use preloading to share tape's main harness.
  const htest = tape.createHarness(pkg);

  const modMap = { ...Compartment.map };
  delete modMap['timer']; // ISSUE: should whitelist
  for (const testModule of testModules) {
    console.log(`running ${testModule}...`);
    const testing = new Compartment(testModule, { console, setTimeout }, modMap);
    // trace('built testing compartment\n');
  }

  const summary = await htest.result();
  console.log('Result:', summary);
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
