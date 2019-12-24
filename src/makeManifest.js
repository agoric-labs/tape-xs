import detective from 'detective-es6';

async function main(argv, { fsp, cabinet }) {
  const [directory, filename] = argv.slice(2);

  const deps = await moduleDeps(filename, {
    getSource: async fn => await fsp.readFile(fn, 'utf-8'),
    findModule: (specifier, fn) => cabinet({
      partial: specifier, directory: directory, filename: fn,
      nodeModulesConfig: { entry: 'module' },
    }),
    filter: fn => !endsWith(fn, '/tape.js'),
  });

  console.log({ deps });
}


function endsWith(haystack, needle) {
  const tail = haystack.slice(haystack.length - needle.length, haystack.length);
  // console.log({ haystack, needle, tail, result: tail === needle });
  return tail === needle;
}


async function moduleDeps(filename, { getSource, findModule, filter }) {
  let queue = [{ filename }];
  const seen = new Set();
  let out = [{ filename }];

  while (queue.length > 0) {
    const { filename: fn } = queue.pop();
    const src = await getSource(fn);
    const deps = detective(src)
	  .map(specifier => ({ specifier, filename: findModule(specifier, fn) }));
    const newDeps = deps.filter(({ filename }) => filter(filename) && !seen.has(filename));
    out = [...out, ...newDeps];
    queue = [...queue, ...newDeps];
    console.log({ fn, deps });
  }
  return out;
}


/* global require, module, process */
if (require.main === module) {
  // Access ambient stuff only when invoked as main module.
  main(process.argv, {
    fsp: require('fs').promises,
    cabinet: require('filing-cabinet'),
  })
    .catch(oops => { console.error(oops); });
}
