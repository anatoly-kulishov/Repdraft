#!/usr/bin/env node
/**
 * Bump root + mobile package.json + app.json to the same version.
 * Usage: node scripts/bump-version.mjs 0.23.0
 * Does not commit.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const next = process.argv[2];
if (!next || !/^\d+\.\d+\.\d+$/.test(next)) {
	console.error('Usage: npm run bump:version -- 0.23.0');
	process.exit(1);
}

function detectIndent(raw) {
	const match = raw.match(/^[ \t]+(?=")/m);
	return match ? match[0] : '\t';
}

function bumpJson(filePath, mutator) {
	const raw = readFileSync(filePath, 'utf8');
	const indent = detectIndent(raw);
	const data = JSON.parse(raw);
	mutator(data);
	writeFileSync(filePath, `${JSON.stringify(data, null, indent)}\n`);
}

bumpJson(path.join(root, 'package.json'), (d) => {
	d.version = next;
});
bumpJson(path.join(root, 'mobile/package.json'), (d) => {
	d.version = next;
});
bumpJson(path.join(root, 'mobile/app.json'), (d) => {
	if (!d.expo) d.expo = {};
	d.expo.version = next;
});

console.log(`bumped version to ${next} (package.json, mobile/package.json, mobile/app.json)`);
console.log('Remember: changelog.ts + GitHub release tag when shipping.');
