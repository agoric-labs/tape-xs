/* global trace */

const { freeze } = Object;

// If you want to defer the test suites and run them after
// loading all the test modules, use:
//   test.deferSuites();
// and then later:
//   await test.runDeferredSuites();

let suitesToRun = undefined;

function deferSuites() {
  suitesToRun = [];
}

async function runDeferredSuites() {
  while (suitesToRun.length) {
    const suite = suitesToRun.shift();
    await suite();
  }
}

function maybeDefer(thunk) {
  if (!suitesToRun) {
    return thunk();
  }
  suitesToRun.push(thunk);
}

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
function tapFormat(writeln_) {
  const writeln = writeln_ || ((txt) => { trace(txt + '\n'); });

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

function makePromise() {
  let resolve, reject;
  const promise = new Promise((win, lose) => {
    resolve = win;
    reject = lose;
  });
  return freeze({ resolve, reject, promise });
}

function createHarness(label) {
  let testNum = 0;
  let passCount = 0;
  let pending = 0;
  let resultP = makePromise();
  let suitesToRun = undefined;

  function summary() {
    return {
      pass: passCount,
      fail: testNum - passCount,
      total: testNum
    };
  }

  const it = freeze({
    finish(ok) {
      testNum += 1;
      if (ok) {
        passCount += 1;
      }
      return testNum;
    },
    deferSuites() {
      suitesToRun = [];
    },
    maybeDefer(thunk) {
      if (!suitesToRun) {
        return thunk();
      }
      suitesToRun.push(thunk);
    },
    async runDeferredSuites() {
      if (suitesToRun) {
        while (suitesToRun.length) {
          const suite = suitesToRun.shift();
          await suite();
        }
        suitesToRun = undefined;
      }
    },
    push(label) {
      pending += 1;
      // console.log('push() =>', pending);
    },
    pop() {
      pending -= 1;
      // console.log('pop() =>', pending);
      if (pending <= 0) {
        resultP.resolve(summary());
      }
    },
    summary,
    reset() {
      if (pending != 0) {
	console.warn(label, 'reset() with pending =', pending);
      }
      pending = 0;
      resultP = makePromise();
    },
    result() {
      return resultP.promise;
    },
  });

  if (!theHarness) {
    theHarness = it;
  }
  return it;
}


function test(label, run, htestOpt) {
  const htest = htestOpt || theHarness || createHarness();
  return htest.maybeDefer(async () => {
    const out = tapFormat(htest.writeln);
    let calledEnd = false;

    out.diagnostic(label);

    function assert(result, info) {
      const testNum = htest.finish(result);
      if (result) {
        out.ok(testNum, info);
      } else {
        out.notOk(testNum, info);
      }
    }

    function ok(value, msg = 'should be truthy') {
      assert(!!value, msg);
    }

    function equal(a, b, msg) {
      assert(a === b, msg || 'should be equal');
    }

    function notEqual(a, b, msg) {
      assert(a !== b, (msg || 'should be not equal') + ` ${a} !== ${b}`);
    }

    function deepEqTest(actual, expected) {
      try {
        assert(deepEqual(actual, expected), 'should be equivalent');
      } catch (detail) {
        const summary = JSON.stringify({ actual, expected });
        assert(false, `should be equivalent: ${summary} : ${detail.message}`);
      }
    }

    const t = freeze({
      end() {
        if (calledEnd) {
          assert(false, 'already called end');
        }
        calledEnd = true;
        htest.pop();
      },
      equal,
      equals: equal,
      notEqual,
      isNot: notEqual,
      deepEqual: deepEqTest,
      deepEquals: deepEqTest,
      throws(thunk, pattern) {
        try {
          thunk();
          assert(false, 'should throw');
        } catch (ex) {
          assert(ex.message.match(pattern), `should throw like ${pattern}`);
        }
      },
      async rejects(thunk, expected) {
        try {
          await thunk();
    assert(false, `should reject like ${expected}`);
        } catch (ex) {
    const ok = typeof expected === 'function' ? ex instanceof expected : ex.message.match(expected);
          assert(ok, `should reject like ${expected}`);
        }
      },
      ok,
      true: ok,
      assert: ok,
      notOk(a, message = 'should be falsy') {
        assert(!a, message);
      },
      is(a, b, message = 'should be identical') {
        assert(Object.is(a, b), message);
      },
    });

    htest.push(label);
    try {
      await run(t);
    } catch (ex) {
      assert(false, `thrown: ${ex.message}`);
    }

    if (!calledEnd) {
      assert(false, `must call end(): ${label}`);
      t.end();
    }
  });
}

test.skip = function skip(label, htestOpt) {
  const htest = htestOpt || theHarness || createHarness();
  return htest.maybeDefer(() => {
    const out = tapFormat(htest.writeln);
    out.skip(null, label);
  });
};


test.createHarness = createHarness;
freeze(test);

export default test;
export { test };
