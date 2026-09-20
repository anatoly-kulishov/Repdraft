/**
 * Run all src/lib/server/ai/*.selfcheck.ts files.
 * Usage: node scripts/run-ai-selfchecks.mjs
 */
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const register = join(here, 'register-domain-selfcheck.mjs');
const aiDir = join(root, 'src/lib/server/ai');

const files = readdirSync(aiDir)
	.filter((name) => name.endsWith('.selfcheck.ts'))
	.sort();

if (files.length === 0) {
	console.error('No AI selfchecks found');
	process.exit(1);
}

for (const name of files) {
	const file = join(aiDir, name);
	console.log(`\n=== ${name} ===`);
	const result = spawnSync(
		process.execPath,
		['--import', register, '--experimental-strip-types', file],
		{ stdio: 'inherit', cwd: root }
	);
	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
}
