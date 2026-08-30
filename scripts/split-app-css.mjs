#!/usr/bin/env node
/**
 * Split app.css into ordered block files (contiguous lines — cascade-safe).
 * Regenerate: node scripts/split-app-css.mjs
 * Source backup: scripts/app.css.monolith.bak (create once before first run).
 */
import { copyFile, mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcPath = join(root, 'src/lib/styles/app.css');
const backupPath = join(root, 'scripts/app.css.monolith.bak');
const outDir = join(root, 'src/lib/styles/blocks');

/** 1-based inclusive line ranges — must cover entire monolith in original order. */
const CHUNKS = [
	{ name: 'tokens', start: 1, end: 296 },
	{ name: 'shell', start: 297, end: 972 },
	{ name: 'typography', start: 973, end: 1054 },
	{ name: 'surfaces', start: 1055, end: 1263 },
	{ name: 'shared-lists', start: 1264, end: 2001 },
	{ name: 'controls', start: 2002, end: 2690 },
	{ name: 'catalog', start: 2691, end: 5617 },
	{ name: 'home', start: 5618, end: 7977 },
	{ name: 'live', start: 7978, end: 10677 },
	{ name: 'builder', start: 10679, end: 13206 },
	{ name: 'screen-misc', start: 13207, end: 15456 },
	{ name: 'error-articles', start: 15457, end: 16107 },
	{ name: 'utilities', start: 16108, end: 16117 }
];

async function main() {
	let css;
	try {
		await access(backupPath);
		css = await readFile(backupPath, 'utf8');
	} catch {
		css = await readFile(srcPath, 'utf8');
		if (!css.includes(':root')) throw new Error('app.css missing :root — abort');
		await copyFile(srcPath, backupPath);
		console.log('backup → scripts/app.css.monolith.bak');
	}

	const lines = css.split('\n');
	const total = lines.length;
	const lastEnd = CHUNKS[CHUNKS.length - 1].end;
	if (lastEnd !== total) {
		throw new Error(`Chunk end ${lastEnd} != file lines ${total} — update CHUNKS`);
	}

	await mkdir(outDir, { recursive: true });

	for (const chunk of CHUNKS) {
		const slice = lines.slice(chunk.start - 1, chunk.end).join('\n').trim();
		await writeFile(join(outDir, `${chunk.name}.css`), `${slice}\n`, 'utf8');
	}

	const imports = CHUNKS.map((c) => `@import './blocks/${c.name}.css';`).join('\n');
	await writeFile(
		srcPath,
		`/* Aggregator — blocks in ./blocks/ (scripts/split-app-css.mjs). Cascade order preserved. */\n${imports}\n`,
		'utf8'
	);

	console.log(
		'split-app-css:',
		CHUNKS.map((c) => `${c.name}:${c.end - c.start + 1}`).join(', ')
	);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
