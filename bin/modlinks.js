/** modlinks: resolve module specifiers
 */

import detective from 'detective-es6';

const USAGE = 'modlinks DIR FILE...';

const xs_resource = [
  'Resource',
];

const xs_node_api = [
  'crypto',
  'events',
  'fs',
  'path',
  'util',
];

const xs_npm = [
  'rollup',
  'semver',
  'ses',
  'tape-promise/tape',
  'tape',
  'moddable-sdk',
  '@agoric/harden',
  '@agoric/bundle-source',
  '@agoric/default-evaluate-options',
];

async function main(argv, { assets, env, fsp, resolve, cabinet }) {
  const [directory, ...filenames] = argv.slice(2);
  const pkg = directory.replace(/\/$/, '').split('/').slice(-1)[0];

  if (!directory || !pkg || filenames.length < 1) { throw USAGE; }

  let allDeps = [];

  function fromTop(p) {
    if (p && p.startsWith(env.XS_NODE_API)) {
      return p.replace(env.XS_NODE_API, '$(XS_NODE_API)');
    }
    if (p && p.startsWith(directory)) {
      return p.replace(directory, '$(TOP)/');
    }
    return p;
  }

  // $(TOP)/d1/m2.js => top/d1/m2
  const toModKey= f => f.replace(/\.js$/, '')
	.replace(/\$\(([A-Z_]+)\)\//, (_, n) => `${n.toLowerCase()}/`);

  for (let filename of filenames) {
    filename = resolve(filename);
    const deps = await moduleDeps(filename, {
      getSource: async fn => await fsp.readFile(fn, 'utf-8'),
      findModule: (specifier, fn) =>
	xs_node_api.includes(specifier) ? `$(XS_NODE_API)/${specifier}.js` :
	xs_npm.includes(specifier) ? `$(XS_NPM)/${specifier}.js` :
	specifier.startsWith('moddable-sdk') ? `$(MODULES)${specifier.replace(/^moddable-sdk/, '')}` :
	cabinet({
	  partial: specifier, directory, filename: fn,
	  nodeModulesConfig: { entry: 'module' },
	}),
      env,
      // we don't want require(module)('x')
      filter: dep => dep.specifier !== 'module',
    });
    deps.forEach((d) => {
      d.specifier = d.specifier.replace(directory, './');
      d.filename = fromTop(d.filename);
      d.referrer = fromTop(d.referrer);
    });
    const compartment = Object.fromEntries(deps.map(
      ({ specifier, filename }) => [
	// leave bare specifiers alone
	specifier.match(/^[\.\/]/) ? toModKey(filename) : specifier,
	toModKey(filename),
      ]
    ));
    // console.log({ filename, deps });
    allDeps.push({
      root: toModKey(fromTop(filename)),
      TOP: directory,
      compartment,
      deps,
    });
  }

  const result = { package: pkg, modmap: `package-manifest.json`, compartments: 'compartments.js' };

  const uniq = a => Array.from(new Set(a));
  const alljs = uniq(allDeps.flatMap(c => c.deps.map(d => d.filename))).sort();
  const modules = Object.fromEntries(alljs.map(f => [toModKey(f), f.replace(/\.js$/, '')]));
  const prefixes = a => a.length == 0 ? [] : [...prefixes(a.slice(0, -1)), a];
  const dirs = Object.keys(modules).flatMap(k => prefixes(k.split('/').slice(0, -1)).map(segs => segs.join('/')));
  const dirMarkers = Object.fromEntries(dirs.map(d => [`${d}/_MAKEDIR`, '/dev/null']));
  const manifest = {
    '$import_map': allDeps,
    modules: { ...dirMarkers, ...modules },
  };
  const manifest_json = JSON.stringify(manifest, null, 2);
  await fsp.writeFile(result.modmap, manifest_json);
  await fsp.writeFile(result.compartments, `export const manifest = ${manifest_json};`);

  console.log(result);
}


async function moduleDeps(filename, { getSource, findModule, filter, env }) {
  let queue = [{ filename }];
  const seen = new Set();
  let out = [{ specifier: filename.replace(/\.js$/, ''), filename }];

  while (queue.length > 0) {
    let { filename: fn, specifier, referrer } = queue.pop();
    if (specifier && specifier.startsWith('moddable-sdk')) {
      // avoid extended syntax
      continue;
    }

    if (fn.startsWith('$(')) {
      fn = fn.replace(/\$\(([A-Z_]+)\)/, (_, n) => env[n]);
    }
    // console.error({ referrer, specifier });
    let src;
    try {
      src = await getSource(fn);
    } catch (err) {
      console.error({ referrer, specifier });
      throw(err);
    }
    const deps = detective(src)
	  .map(specifier => ({
	    referrer: fn,
	    specifier,
	    filename: findModule(specifier, fn),
	  }));
    out = [...out, ...deps];
    const newDeps = deps.filter(dep => filter(dep) && !seen.has(dep.filename));
    newDeps.forEach(({ filename }) => seen.add(filename));
    queue = [...queue, ...newDeps];
  }
  return out;
}

/* global require, module, process, __dirname */
if (require.main === module) {
  // Access process authority only when invoked as script.
  main(process.argv, {
    fsp: require('fs').promises,
    env: process.env,
    resolve: require('path').resolve,
    cabinet: require('filing-cabinet'),
    assets: __dirname.replace(/\/bin$/, ''),
  })
	.catch(oops => {
	    console.error(oops);
	    console.error(oops.stack);
	});
}
