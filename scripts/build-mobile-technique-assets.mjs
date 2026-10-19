#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(process.cwd());
const fullPath = resolve(repoRoot, 'static/data/exercises.full.json');
const outPath = resolve(repoRoot, 'mobile/assets/data/exercises.technique.json');

const full = JSON.parse(readFileSync(fullPath, 'utf8'));

/** Bundle only ru/en step lists to keep the dev/offline asset small. */
function pickLocales(obj) {
	if (!obj || typeof obj !== 'object') return {};
	const picked = {};
	for (const locale of ['ru', 'en']) {
		if (locale in obj) picked[locale] = obj[locale];
	}
	return picked;
}

const technique = {};
for (const ex of full) {
	technique[ex.id] = {
		id: ex.id,
		name: ex.name,
		name_ru: ex.name_ru ?? '',
		body_part: ex.body_part,
		equipment: ex.equipment,
		target: ex.target,
		image: ex.image,
		instructions: {},
		instruction_steps: pickLocales(ex.instruction_steps)
	};
}

writeFileSync(outPath, JSON.stringify(technique));
const sizeKB = Math.round(Buffer.byteLength(JSON.stringify(technique), 'utf8') / 1024);
console.log(
	`[repdraft] built mobile technique asset: ${full.length} exercises (${sizeKB} KB) -> ${outPath}`
);
