#!/usr/bin/env node
/**
 * Root package.json, mobile/package.json, and mobile/app.json must share the same version.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const rootPkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const mobilePkg = JSON.parse(readFileSync(path.join(root, 'mobile/package.json'), 'utf8'));
const appJson = JSON.parse(readFileSync(path.join(root, 'mobile/app.json'), 'utf8'));

const versions = {
	'package.json': rootPkg.version,
	'mobile/package.json': mobilePkg.version,
	'mobile/app.json expo.version': appJson?.expo?.version
};

const unique = new Set(Object.values(versions));
if (unique.size !== 1 || ![...unique][0]) {
	console.error('Version mismatch across clients:');
	for (const [label, v] of Object.entries(versions)) {
		console.error(`  ${label}: ${v ?? '(missing)'}`);
	}
	process.exit(1);
}

console.log(`check:versions ok (${[...unique][0]})`);
