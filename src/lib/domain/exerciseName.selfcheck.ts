import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exerciseName, isDisplayableRuName } from './exerciseName.ts';
import type { ExerciseIndexItem } from './types';

function titleCase(raw: string): string {
	return raw
		.trim()
		.split(/\s+/)
		.map((part) => (part ? part[0]!.toUpperCase() + part.slice(1) : part))
		.join(' ');
}

export function runExerciseNameSelfCheck(): void {
	const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
	const index = JSON.parse(
		readFileSync(join(root, 'static/data/exercises.index.json'), 'utf8')
	) as ExerciseIndexItem[];

	let englishFallback = 0;
	for (const item of index) {
		if (exerciseName(item, 'ru') === titleCase(item.name)) englishFallback += 1;
	}
	if (englishFallback > 0) {
		throw new Error(`exercise names: ${englishFallback} still fall back to English`);
	}

	const shoulderTap = index.find((item) => item.id === '3699');
	if (!shoulderTap || !exerciseName(shoulderTap, 'ru').includes('плеч')) {
		throw new Error('shoulder tap should have Russian title');
	}

	const windmill = index.find((item) => item.id === '0554');
	if (!windmill || exerciseName(windmill, 'ru') !== 'Мельница с гирей') {
		throw new Error('kettlebell windmill should translate to Мельница с гирей');
	}

	if (isDisplayableRuName('Плеча tap')) {
		throw new Error('mixed EN/RU like "Плеча tap" must not pass displayable check');
	}
}

runExerciseNameSelfCheck();
console.log('exerciseName self-check ok');
