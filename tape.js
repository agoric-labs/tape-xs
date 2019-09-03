import { console } from 'xs-platform/console';

const { freeze } = Object;

// ack Paul Roub Aug 2014
// https://stackoverflow.com/a/25456134/7963
function deepEqual(x, y) {
  if (x === y) {
    return true;
  }
  if (
    typeof x === 'object' &&
    x != null &&
    (typeof y === 'object' && y != null)
  ) {
    if (Object.keys(x).length !== Object.keys(y).length) {
      const detail = JSON.stringify({
        actual: {
          length: Object.keys(x).length,
          keys: Object.keys(x),
        },
        expected: {
          length: Object.keys(y).length,
          keys: Object.keys(y),
        },
      });
      throw new Error(`Object keys length: ${detail}`);
    }

    for (const prop in x) {
      // eslint-disable-next-line no-prototype-builtins
      if (y.hasOwnProperty(prop)) {
        if (!deepEqual(x[prop], y[prop])) {
          return false;
        }
      } else {
        throw new Error(`missing property ${prop}`);
      }
    }

    return true;
  }
  const detail = JSON.stringify({
    actual: { type: typeof x, value: x },
    expected: { type: typeof y, value: y },
  });
  throw new Error(detail);
}

export async function test(label, run) {
  let result = null;

  function fail(info) {
    console.log(label, info);
    result = false;
  }

  const t = freeze({
    end() {
      if (result === null) {
        result = true;
      }
    },
    equal(a, b) {
      if (a !== b) {
        fail('not equal. IOU details');
      }
    },
    deepEqual(actual, expected) {
      try {
        deepEqual(actual, expected);
      } catch (detail) {
        const summary = JSON.stringify({ actual, expected });
        fail(`not deepEqual: ${summary} : ${detail.message}`);
      }
    },
    throws(thunk, pattern) {
      try {
        thunk();
        result = false;
      } catch (ex) {
        result = ex.message.match(pattern);
      }
    },
    ok(a) {
      if (!a) {
        fail('not ok');
      }
    },
    notOk(a) {
      if (a) {
        fail('unexpected ok');
      }
    },
    is(a, b) {
      if (!Object.is(a, b)) {
        fail('Object.is failed');
      }
    },
  });

  try {
    await run(t);
  } catch (ex) {
    fail(`thrown: ${ex.message}`);
  }

  if (result === null) {
    fail('not ended');
  }
  console.log(`  - [${result ? 'x' : ''}] ${label} ${result ? '' : ' - FAIL'}`);
}

test.skip = function skip(label) {
  console.log(label, 'SKIP');
};
