#!/usr/bin/env node
/**
 * Fail if tokens.core.generated.css is stale vs src/lib/design/tokens.ts.
 */
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const committed = path.join(root, 'src/lib/styles/blocks/tokens.core.generated.css');
const current = readFileSync(committed, 'utf8');

const tmp = mkdtempSync(path.join(tmpdir(), 'repdraft-tokens-'));
const tmpOut = path.join(tmp, 'tokens.core.generated.css');

const build = spawnSync(process.execPath, [path.join(root, 'scripts/build-design-tokens.mjs')], {
	cwd: root,
	encoding: 'utf8',
	env: { ...process.env, REPDRAFT_TOKENS_OUT: tmpOut }
});

if (build.status !== 0) {
	console.error(build.stderr || build.stdout);
	rmSync(tmp, { recursive: true, force: true });
	process.exit(1);
}

const expected = readFileSync(tmpOut, 'utf8');
rmSync(tmp, { recursive: true, force: true });

if (expected !== current) {
	console.error(
		'tokens.core.generated.css is stale. Run: npm run build:tokens\n' +
			'(src/lib/design/tokens.ts changed without regenerating CSS.)'
	);
	process.exit(1);
}

console.log('check:tokens ok');
