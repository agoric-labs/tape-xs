/** modlinks: resolve module specifiers
 */

import detective from 'detective-es6';

const USAGE = 'modlinks WORKSPACE FILE...';

const xs_resource = [
  'Resource',
];

const xs_node_api = [
  'crypto',
  'child_process',
  'events',
  'fs',
  'http',
  'path',
  'process',
  'util',
];

const xs_npm_todo = [
  'rollup',
  'semver',
  'deterministic-json',
  'tendermint',
  '@agoric/default-evaluate-options',
];

const xs_npm = [
  'express',
  'serve-static',
  'ses',
  'tape-promise/tape',
  'tape',
  'minimist',
  'moddable-sdk',
  'morgan',
  'n-readlines',
  'temp',
  'ws',
  '@agoric/harden',
  '@agoric/bundle-source',
  '@agoric/evaluate',
  ...xs_npm_todo
];

async function main(argv, { assets, env, fsp, resolve, cabinet }) {
  const [workspace, ...filenames] = argv.slice(2);
  if (!workspace || filenames.length < 1) { throw USAGE; }

  const build = {
    MODULES: '$(MODDABLE)/modules',
    WORKSPACE: resolve(workspace),
    XS_NODE_API: resolve(env.XS_NODE_API),
    XS_NPM: resolve(env.XS_NPM),
  };

  const allDeps = [];
  const compartments = [];

  function fromTop(p) {
    if (p && p.startsWith(build.XS_NODE_API)) {
      return p.replace(build.XS_NODE_API, '$(XS_NODE_API)');
    }
    if (p && p.startsWith(build.WORKSPACE)) {
      return p.replace(build.WORKSPACE, '$(WORKSPACE)');
    }
    return p;
  }

  // $(TOP)/d1/m2.js => top/d1/m2
  const toModKey= f => f.replace(/\.js$/, '')
	.replace(/\$\(([A-Z_]+)\)\//, (_, n) => `${n.toLowerCase()}/`);

  for (let filename of filenames) {
    filename = resolve(filename);
    let deps = await moduleDeps(filename, {
      getSource: async fn => await fsp.readFile(fn, 'utf-8'),
      findModule: (specifier, fn) =>
	xs_node_api.includes(specifier) ? `$(XS_NODE_API)/${specifier}.js` :
	xs_npm.includes(specifier) ? `$(XS_NPM)/${specifier}.js` :
	specifier.startsWith('moddable-sdk') ? `$(MODULES)${specifier.replace(/^moddable-sdk/, '')}` :
	cabinet({
	  partial: specifier, directory: workspace, filename: fn,
	  nodeModulesConfig: { entry: 'module' },
	}),
      env,
      resolve,
      // we don't want require(module)('x')
      filter: dep => dep.specifier !== 'module',
    });
    const readlink = async p => (!p || p.startsWith('$')) ? p : await fsp.realpath(p);
    deps = await Promise.all(deps.map(async d => ({
      specifier: d.specifier.replace(workspace, './'),
      filename: fromTop(await readlink(d.filename)),
      referrer: fromTop(await readlink(d.referrer)),
    })));
    const compartment = Object.fromEntries(deps.map(
      ({ specifier, filename }) => [
	// leave bare specifiers alone
	specifier.match(/^[\.\/]/) ? toModKey(filename) : specifier,
	toModKey(filename),
      ]
    ));
    // console.log({ filename, deps });
    allDeps.push(deps);
    compartments.push({
      root: toModKey(fromTop(filename)),
      compartment,
    });
  }

  const result = { compartments: 'xs-compartments.json' };

  build.XS_NODE_API = build.XS_NODE_API.replace(build.WORKSPACE, '$(WORKSPACE)');
  build.XS_NPM = build.XS_NPM.replace(build.WORKSPACE, '$(WORKSPACE)');

  const uniq = a => Array.from(new Set(a));
  const alljs = uniq(allDeps.flatMap(deps => deps.map(d => d.filename))).sort();
  const modules = Object.fromEntries(alljs.map(f => [toModKey(f), f.replace(/\.js$/, '')]));
  const prefixes = a => a.length == 0 ? [] : [...prefixes(a.slice(0, -1)), a];
  const dirs = Object.keys(modules).flatMap(k => prefixes(k.split('/').slice(0, -1)).map(segs => segs.join('/')));
  const dirMarkers = Object.fromEntries(dirs.map(d => [`${d}/_MAKEDIR`, '/dev/null']));
  const manifest = {
    build,
    compartments,
    modules: { ...dirMarkers, ...modules },
  };
  const manifest_json = JSON.stringify(manifest, null, 2);
  await fsp.writeFile(result.compartments, manifest_json);

  console.log(result);
}


async function moduleDeps(filename, { getSource, findModule, filter, env, resolve }) {
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
      fn = fn.replace(/\$\(([A-Z_]+)\)/, (_, n) => resolve(env[n]));
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
