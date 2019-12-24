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

// https://testanything.org/tap-specification.html
function tapFormat(writeln) {
  return freeze({
    ok(testNum, txt) {
      writeln(`ok ${testNum} ${txt}`);
    },
    skip(testNum, txt) {
      writeln(`ok ${testNum || ''} # SKIP ${txt}`);
    },
    notOk(testNum, txt) {
      writeln(`not ok ${testNum} ${txt}`);
    },
    diagnostic(txt) {
      writeln(`# ${txt}`);
    },
  });
}

let theHarness = null;  // ISSUE: ambient

function createHarness() {
  let testNum = 0;
  let passCount = 0;

  const it = freeze({
    finish(ok) {
      testNum += 1;
      if (ok) {
        passCount += 1;
      }
      return testNum;
    },
    summary() {
      return {
        pass: passCount,
        fail: testNum - passCount,
        total: testNum
      };
    },
  });

  if (!theHarness) {
    theHarness = it;
  }
  return it;
}


export default async function test(label, run, htestOpt) {
  const out = tapFormat((txt) => { console.log(txt); });
  let calledEnd = false;
  const htest = htestOpt || theHarness || createHarness();

  out.diagnostic(label);

  function assert(result, info) {
    const testNum = htest.finish(result);
    if (result) {
      out.ok(testNum, info);
    } else {
      out.notOk(testNum, info);
    }
  }

  function equal(a, b) {
    assert(a == b, 'should be equal');
  }

  const t = freeze({
    end() {
      if (calledEnd) {
        assert(false, 'already called end');
      }
      calledEnd = true;
    },
    equal,
    equals: equal,
    deepEqual(actual, expected) {
      try {
        assert(deepEqual(actual, expected), 'should be equivalent');
      } catch (detail) {
        const summary = JSON.stringify({ actual, expected });
        assert(false, `should be equivalent: ${summary} : ${detail.message}`);
      }
    },
    throws(thunk, pattern) {
      try {
        thunk();
        assert(false, 'should throw');
      } catch (ex) {
        assert(ex.message.match(pattern), `should throw like ${pattern}`);
      }
    },
    async rejects(thunk, pattern) {
      try {
        await thunk();
      } catch (ex) {
        assert(ex.message.match(pattern), `should reject like ${pattern}`);
      }
    },
    ok(a) {
      assert(!!a, 'should be truthy');
    },
    notOk(a) {
      assert(!a, 'should be falsy');
    },
    is(a, b) {
      assert(Object.is(a, b), 'should be identical');
    },
  });

  try {
    await run(t);
  } catch (ex) {
    assert(false, `thrown: ${ex.message}`);
  }

  if (!calledEnd) {
    assert(false, `must call end(): ${label}`);
  }
}

test.skip = function skip(label) {
  const out = tapFormat((txt) => { console.log(txt); });
  out.skip(null, label);
};


test.createHarness = createHarness;
