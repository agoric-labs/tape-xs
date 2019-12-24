# tape-xs: tape work-alike for xs

One of main differences between node.js and the [Moddable XS SDK][xs]
is modules: xs supports only ES5 modules. Attempting to port tape
showed extensive cjs dependencies. Incremental development of a
work-alike has worked reasonably well so far.

A typical usage of tape is `npm test` where `package.json` has...

```json
{
  "name": "@agoric/eventual-send",
  "scripts": {
    "test": "tape -r esm 'test/**/test*.js'",
  }
}
```

To run these tests using the [Moddable XS SDK][xs], we make a
[manifest][] and a `main` module:

```
agoric-sdk/packages/eventual-send$ node -r esm .../tape-xs/bin/tape-xs-build.js $(pwd)/ test/test*.js
{ manifest: 'test-xs-manifest.json', main: 'test-xs-main.js' }
try: mcconfig -d -m test-xs-manifest.json
```

[manifest]: https://github.com/Moddable-OpenSource/moddable/blob/public/documentation/tools/manifest.md
[xs]: https://github.com/Moddable-OpenSource/moddable/blob/public/documentation/Moddable%20SDK%20-%20Getting%20Started.md

Then (with `xsbug` running) we run `mcconfig -d -m
test-xs-manifest.json` and in the LOG window, we see:

```
in eventual-send driver...
running test/test-e...
running test/test-hp...
running test/test...
...
ok 3 should be equal
ok 4 should be equal
Result:
{"pass":42,"fail":0,"total":42}
```

## TODO: x-cli-lin platform

Rather than running in the xs simulator with output to the debugger,
this should run as a nomral CLI output:

  - exit, with exit code, when all tests are run
  - output to stdout / stderr

## Limitations: fragile module manifest approach

Building the module map is likely to be fragile.

The xs manifest format is insensitive to the path where a module
specifier is found.  Where in node.js `./E` would refer to one thing
in `lib1/m1.js` and another in `lib2/m2.js`, it can only refer to one
thing in xs.

See [struggling with ../.. in import specifier paths #57](https://github.com/Agoric/agoric-sdk/issues/57).


## Limitations: incremental port of tape API

The tape API is ported incrementally as I run into methods that are
used in Agoric tests. It is unlikely to be complete.


## Issues: @agoric/harden

On xs, `@agoric/harden` fails a runtime assertion, so we use a
different approach. See `src/harden-xs.js` for details.
