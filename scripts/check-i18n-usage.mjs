#!/usr/bin/env node
/**
 * Raw i18n keys (`tt('foo.bar')`) are invisible to tsc and to E2E: a typo or a
 * renamed key renders the key itself on screen. This scans the literal key
 * arguments in both clients and fails when a key is missing from messages.ts.
 *
 * Dynamic keys (`tt(setKindMessageKey(kind))`) and plural lookups are resolved at
 * runtime and are out of scope here.
 */
import { readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const MESSAGES = path.join(ROOT, 'src/lib/i18n/messages.ts');

/** Any `'some.key':` at any depth counts: locales nest blocks for readability. */
function definedKeys(source) {
	const keys = new Set();
	for (const match of source.matchAll(/'([A-Za-z0-9_.]+)'\s*:/g)) keys.add(match[1]);
	return keys;
}

const CALL_PATTERNS = [
	/\btt\(\s*'([A-Za-z0-9_.]+)'/g,
	/\btranslate\(\s*[^,()]+,\s*'([A-Za-z0-9_.]+)'/g
];

function usedKeys(source) {
	const keys = new Set();
	for (const pattern of CALL_PATTERNS) {
		for (const match of source.matchAll(pattern)) keys.add(match[1]);
	}
	return keys;
}

async function walk(dir, extensions) {
	const out = [];
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) out.push(...(await walk(full, extensions)));
		else if (extensions.some((ext) => entry.name.endsWith(ext))) out.push(full);
	}
	return out;
}

const defined = definedKeys(readFileSync(MESSAGES, 'utf8'));
const files = [
	...(await walk(path.join(ROOT, 'src'), ['.svelte', '.ts'])),
	...(await walk(path.join(ROOT, 'mobile'), ['.tsx', '.ts']))
].filter((file) => file !== MESSAGES && !file.endsWith('messages.ts'));

const missing = new Map();
for (const file of files) {
	const source = readFileSync(file, 'utf8');
	for (const key of usedKeys(source)) {
		if (defined.has(key)) continue;
		const list = missing.get(key) ?? [];
		list.push(path.relative(ROOT, file));
		missing.set(key, list);
	}
}

if (missing.size === 0) {
	console.log(`i18n usage ok: ${files.length} files, all literal keys defined`);
	process.exit(0);
}

console.error(`Missing i18n keys (${missing.size}):`);
for (const [key, list] of [...missing].sort()) {
	console.error(`  ${key} <- ${[...new Set(list)].join(', ')}`);
}
process.exit(1);
