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

	const smith = index.find((item) => item.id === '0770');
	const smithFull = index.find((item) => item.id === '3281');
	const smithSumo = index.find((item) => item.id === '3142');
	if (!smith || exerciseName(smith, 'ru') !== 'Присед в машине Смита') {
		throw new Error('smith squat should stay Присед в машине Смита');
	}
	if (!smithFull || exerciseName(smithFull, 'ru') !== 'Полный присед в машине Смита') {
		throw new Error('smith full squat should be Полный присед в машине Смита');
	}
	if (!smithSumo || exerciseName(smithSumo, 'ru') !== 'Сумо-присед в машине Смита') {
		throw new Error('smith sumo squat should be Сумо-присед в машине Смита');
	}

	const byRu = new Map<string, ExerciseIndexItem[]>();
	for (const item of index) {
		const ru = exerciseName(item, 'ru');
		const group = byRu.get(ru) ?? [];
		group.push(item);
		byRu.set(ru, group);
	}
	const collisions = [...byRu.entries()].filter(([, group]) => group.length > 1);
	if (collisions.length > 0) {
		const sample = collisions
			.slice(0, 5)
			.map(([name, group]) => `${name}: ${group.map((item) => item.id).join(',')}`)
			.join('; ');
		throw new Error(`exercise names: ${collisions.length} duplicate RU titles (${sample})`);
	}

	const faceDownCurl = index.find((item) => item.id === '1766');
	if (!faceDownCurl || !exerciseName(faceDownCurl, 'ru').includes('тренаж')) {
		throw new Error('self-assisted inverse curl 1766 should name the machine setup');
	}

	const behindNeck = index.find((item) => item.id === '0788');
	if (!behindNeck || !exerciseName(behindNeck, 'ru').includes('из-за головы')) {
		throw new Error('behind-neck press should say из-за головы');
	}

	if (isDisplayableRuName('Плеча tap')) {
		throw new Error('mixed EN/RU like "Плеча tap" must not pass displayable check');
	}

	const upwardDog = {
		id: '1366',
		name: 'upward facing dog',
		name_ru: 'Вверх лицом собака'
	};
	if (exerciseName(upwardDog, 'ru') !== 'Собака мордой вверх') {
		throw new Error(`upward facing dog should be «Собака мордой вверх», got ${exerciseName(upwardDog, 'ru')}`);
	}

	const lateral = index.find((item) => item.id === '0150');
	if (!lateral || exerciseName(lateral, 'ru') !== 'Тяга верхнего блока с грифом') {
		throw new Error(
			`cable bar lateral pulldown should be «Тяга верхнего блока с грифом», got ${lateral ? exerciseName(lateral, 'ru') : 'missing'}`
		);
	}
	const wideAngle = index.find((item) => item.id === '1587');
	if (!wideAngle || exerciseName(wideAngle, 'ru') !== 'Поза широкого угла сидя') {
		throw new Error(
			`seated wide angle pose should be «Поза широкого угла сидя», got ${wideAngle ? exerciseName(wideAngle, 'ru') : 'missing'}`
		);
	}
	const lowRow = {
		id: 'tmp-low-row',
		name: 'cable low seated row',
		name_ru: 'Низкий тяга сидя на блоке'
	};
	if (exerciseName(lowRow, 'ru') !== 'Низкая тяга сидя на блоке') {
		throw new Error(`тяга must agree in gender, got ${exerciseName(lowRow, 'ru')}`);
	}

	const donkey = index.find((item) => item.id === '0284');
	if (!donkey || exerciseName(donkey, 'ru') !== 'Подъём на носки «ослик»') {
		throw new Error(
			`donkey calf raise should be «Подъём на носки «ослик»», got ${donkey ? exerciseName(donkey, 'ru') : 'missing'}`
		);
	}
}

runExerciseNameSelfCheck();
console.log('exerciseName self-check ok');
