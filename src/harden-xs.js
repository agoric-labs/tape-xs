// xs throws GeneratorFunction.__proto__ was not Function.prototype.constructor
// https://github.com/Agoric/harden/issues/47
// So we use deep freezing instead
// https://github.com/Moddable-OpenSource/moddable/blob/public/documentation/xs/preload.md#deep-freezing
// It fails one test:
// Agoric/harden#54 why complain about prototype not in roots?
export default function harden(x) {
  return Object.freeze(x, true);
}

