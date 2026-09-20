/**
 * Node ESM resolve hook: `$lib/*` → src/lib + extensionless → `.ts`.
 * Used only by domain selfchecks (`npm run check:domain`).
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const libRoot = join(repoRoot, 'src/lib');
const envStub = pathToFileURL(join(repoRoot, 'scripts/selfcheck-env-stub.mjs')).href;

function withTs(path) {
	if (/\.(ts|js|mjs|cjs|json)$/.test(path)) return path;
	const asTs = `${path}.ts`;
	if (existsSync(asTs)) return asTs;
	const asIndex = join(path, 'index.ts');
	if (existsSync(asIndex)) return asIndex;
	return path;
}

export async function resolve(specifier, context, nextResolve) {
	if (specifier.startsWith('$env/')) {
		return { shortCircuit: true, url: envStub };
	}

	if (specifier.startsWith('$lib/') || specifier === '$lib') {
		const rel = specifier === '$lib' ? '' : specifier.slice('$lib/'.length);
		const resolved = withTs(join(libRoot, rel));
		return nextResolve(pathToFileURL(resolved).href, context);
	}

	if (
		(specifier.startsWith('./') || specifier.startsWith('../')) &&
		!/\.(ts|js|mjs|cjs|json|svelte|css)$/.test(specifier)
	) {
		const parent = context.parentURL ? dirname(fileURLToPath(context.parentURL)) : repoRoot;
		const resolved = withTs(join(parent, specifier));
		if (existsSync(resolved)) {
			return nextResolve(pathToFileURL(resolved).href, context);
		}
	}

	return nextResolve(specifier, context);
}

/** Bundler-style bare JSON imports need a short-circuit under Node ESM. */
export async function load(url, context, nextLoad) {
	if (url.endsWith('.json')) {
		const source = readFileSync(fileURLToPath(url), 'utf8');
		return {
			format: 'json',
			shortCircuit: true,
			source
		};
	}
	return nextLoad(url, context);
}
