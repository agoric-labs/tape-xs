import detective from 'detective-es6';

const here = '/home/connolly/projects/agoric/tape-xs'; // TODO: FIXME

const replacements = {
  'tape-promise/tape':   `${here}/tape`,
  '@agoric/harden':      `${here}/src/harden-xs`,
};

async function main(argv, stdout, { fsp, cabinet }) {
  const [directory, filename] = argv.slice(2);

  const deps = await moduleDeps(filename, {
    getSource: async fn => await fsp.readFile(fn, 'utf-8'),
    findModule: (specifier, fn) => cabinet({
      partial: specifier, directory: directory, filename: fn,
      nodeModulesConfig: { entry: 'module' },
    }),
    filter: dep => !Object.keys(replacements).includes(dep.specifier),
  });

  const manifest = moduleManifest(deps, directory);
  stdout.write(JSON.stringify(manifest, null, 2));
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
    const newDeps = deps.filter(dep => filter(dep) && !seen.has(dep.filename));
    out = [...out, ...newDeps];
    queue = [...queue, ...newDeps];
    // console.log({ fn, deps });
  }
  return out;
}


function moduleManifest(deps, topDir) {
  // xs doesn't want .js on the end of source filenames
  const stripExt = fn => fn.replace(/.js$/, '');

  function relative(fullPath) {
    return './' + fullPath.slice(topDir.length);
  }

  function modKey(specifier, fullPath) {
    const bare = typeof specifier === 'string' && !/^\.\.?\//.exec(specifier);
    const local = fullPath.startsWith(topDir);
    return bare ? specifier : local ? stripExt(relative(fullPath)) : specifier;
  }

  const modules = Object.fromEntries(deps.map(
    ({ specifier, filename }) => [modKey(specifier, filename), stripExt(filename)]
  ));
  return {
    include: "$(MODDABLE)/examples/manifest_base.json",
    strip: [],
    creation: {
      keys: {
	// somewhat arbitrary but larger than microcontroller-oriented default
	available: 4096,
      },
      stack: 4096
    },
    modules: {
      main: "./main",
      'xs-platform/console': `${here}/console`,
      ...replacements,
      ...modules,
    },
  };
}


/* global require, module, process */
if (require.main === module) {
  // Access ambient stuff only when invoked as main module.
  main(process.argv, process.stdout, {
    fsp: require('fs').promises,
    cabinet: require('filing-cabinet'),
  })
    .catch(oops => { console.error(oops); });
}
