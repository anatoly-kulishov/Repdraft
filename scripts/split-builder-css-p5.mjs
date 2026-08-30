/**
 * P5: move misplaced chunks out of builder.css into target block files.
 * Run from repo root: node scripts/split-builder-css-p5.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const blocks = join(root, 'src/lib/styles/blocks');

/** @param {string} file */
function readLines(file) {
	return readFileSync(join(blocks, file), 'utf8').split('\n');
}

/** @param {string} file @param {string} chunk */
function appendChunk(file, chunk) {
	if (!chunk.trim()) return;
	const path = join(blocks, file);
	const existing = readFileSync(path, 'utf8').replace(/\n?$/, '\n');
	const marker = `\n/* — moved from builder.css (P5) — */\n`;
	writeFileSync(path, existing + marker + chunk.replace(/^\n/, ''));
}

/** @param {string[]} lines @param {[number, number][]} ranges 1-based inclusive */
function sliceRanges(lines, ranges) {
	return ranges
		.map(([start, end]) => lines.slice(start - 1, end).join('\n'))
		.filter(Boolean)
		.join('\n\n');
}

const builder = readLines('builder.css');

const builderKeep = sliceRanges(builder, [
	[1, 18],
	[310, 1193]
]);

appendChunk('catalog.css', sliceRanges(builder, [[1601, 1896]]));

appendChunk(
	'screen-misc.css',
	sliceRanges(builder, [
		[20, 94],
		[100, 191],
		[1334, 1386],
		[1396, 1432],
		[1898, 2312],
		[2314, 2478]
	])
);

appendChunk('live.css', sliceRanges(builder, [[192, 291]]));

appendChunk('shell.css', sliceRanges(builder, [[1462, 1520]]));

const workouts = sliceRanges(builder, [
	[95, 98],
	[292, 309],
	[1194, 1333],
	[1388, 1394],
	[1434, 1460],
	[1522, 1599]
]);
writeFileSync(join(blocks, 'workouts.css'), workouts + '\n');

writeFileSync(join(blocks, 'builder.css'), builderKeep + '\n');

console.log('P5 builder split done.');
console.log(`  builder.css: ${builderKeep.split('\n').length} lines`);
console.log(`  workouts.css: ${workouts.split('\n').length} lines`);
