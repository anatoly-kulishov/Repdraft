#!/usr/bin/env node
/** Copy server catalog JSON into static/ for runtime fetch (keeps it out of the SSR bundle). */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const sourcePath = path.join(root, 'data/exercises.full.json');
const targetPath = path.join(root, 'static/data/exercises.full.json');

if (!fs.existsSync(sourcePath)) {
	console.error(`Missing ${sourcePath}`);
	process.exit(1);
}

fs.mkdirSync(path.dirname(targetPath), { recursive: true });
fs.copyFileSync(sourcePath, targetPath);
console.log(`Copied catalog → ${path.relative(root, targetPath)}`);
