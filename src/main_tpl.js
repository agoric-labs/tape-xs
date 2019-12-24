/* global Compartment, trace */
import Timer from 'timer';

const harden = x => Object.freeze(x, true);

export default async function main() {
  trace('in main.\n');
  trace(JSON.stringify(Object.keys(Compartment.map), null, 2));
  const { setTimeout } = makeTimer(Timer);
  const modMap = { ...Compartment.map };
  delete modMap['timer']; // ISSUE: should whitelist
  const c1 = new Compartment('test/test', { setTimeout }, modMap);
  trace('c1\n');
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
