#!/usr/bin/env node
/**
 * Rebuilds slim catalog index from the server-only full catalog.
 * Usage: npm run build:data
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const sourcePath = path.join(root, 'data/exercises.full.json');
const indexPath = path.join(root, 'static/data/exercises.index.json');

if (!fs.existsSync(sourcePath)) {
	console.error(`Missing ${sourcePath}`);
	process.exit(1);
}

const full = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
if (!Array.isArray(full)) {
	console.error('exercises.full.json must be an array');
	process.exit(1);
}

const index = full.map((ex) => ({
	id: ex.id,
	name: ex.name,
	name_ru: ex.name_ru,
	body_part: ex.body_part,
	equipment: ex.equipment,
	target: ex.target,
	muscle_group: ex.muscle_group,
	secondary_muscles: ex.secondary_muscles,
	image: ex.image
}));

fs.mkdirSync(path.dirname(indexPath), { recursive: true });
fs.writeFileSync(indexPath, JSON.stringify(index));
console.log(`Wrote ${index.length} index rows → ${path.relative(root, indexPath)}`);
