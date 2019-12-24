export default async function main() {
  trace('in main.\n');
  const c0 = new Compartment('tape-promise/tape');
  trace('c0\n');
  trace(JSON.stringify(Object.keys(Compartment.map), null, 2));
  const c1 = new Compartment('@agoric/harden');
  trace('c1\n');
}
