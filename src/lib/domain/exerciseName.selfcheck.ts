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
	if (!smith || exerciseName(smith, 'ru') !== 'Приседания в тренажёре Смита') {
		throw new Error('smith squat should be Приседания в тренажёре Смита');
	}
	if (!smithFull || exerciseName(smithFull, 'ru') !== 'Полные приседания в тренажёре Смита') {
		throw new Error('smith full squat should be Полные приседания в тренажёре Смита');
	}
	if (!smithSumo || exerciseName(smithSumo, 'ru') !== 'Сумо-приседания в тренажёре Смита') {
		throw new Error('smith sumo squat should be Сумо-приседания в тренажёре Смита');
	}

	const smithSeatedPress = index.find((item) => item.id === '0765');
	const smithPressDup = index.find((item) => item.id === '0766');
	if (
		!smithSeatedPress ||
		exerciseName(smithSeatedPress, 'ru') !== 'Жим штанги сидя в тренажёре Смита'
	) {
		throw new Error('0765 should be Жим штанги сидя в тренажёре Смита');
	}
	if (
		!smithPressDup ||
		exerciseName(smithPressDup, 'ru') !== 'Жим штанги сидя в тренажёре Смита (другой ракурс)'
	) {
		throw new Error('0766 should be marked as другой ракурс of seated smith press');
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
	if (!lateral || exerciseName(lateral, 'ru') !== 'Вертикальная тяга широким хватом') {
		throw new Error(
			`cable bar lateral pulldown should be «Вертикальная тяга широким хватом», got ${lateral ? exerciseName(lateral, 'ru') : 'missing'}`
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

	const delavierNames: Array<[string, string]> = [
		['0025', 'Жим штанги лёжа'],
		['0052', 'JM-жим со штангой'],
		['0201', 'Жим к низу в блочном тренажёре'],
		['0031', 'Подъём штанги на бицепс стоя'],
		['0042', 'Приседания со штангой на груди'],
		['0043', 'Приседания со штангой'],
		['0180', 'Горизонтальная тяга в блочном тренажёре'],
		['0861', 'Горизонтальная тяга в блочном тренажёре (другой ракурс)'],
		['0334', 'Разведение гантелей стоя'],
		['0060', 'Французский жим лёжа'],
		['0044', 'Гудморнинг'],
		['0203', 'Тяга блока на заднюю дельту'],
		['0003', 'Велосипедные скручивания'],
		['0662', 'Отжимания от пола'],
		['0284', 'Подъёмы на носки в наклоне']
	];
	for (const [id, expected] of delavierNames) {
		const item = index.find((row) => row.id === id);
		const got = item ? exerciseName(item, 'ru') : 'missing';
		if (got !== expected) {
			throw new Error(`${id} should be «${expected}», got ${got}`);
		}
	}

	const pushdown = index.find((item) => item.id === '0201');
	if (!pushdown || !exerciseName(pushdown, 'ru').includes('к низу')) {
		throw new Error('cable pushdown must use spaced «к низу», not «книзу»');
	}
	if (exerciseName(pushdown!, 'ru').includes('книзу')) {
		throw new Error('cable pushdown must not contain glued «книзу»');
	}

	const donkey = index.find((item) => item.id === '0284');
	if (!donkey || exerciseName(donkey, 'ru') !== 'Подъёмы на носки в наклоне') {
		throw new Error(
			`donkey calf raise should be «Подъёмы на носки в наклоне», got ${donkey ? exerciseName(donkey, 'ru') : 'missing'}`
		);
	}

	// Stale full.json calques must still display gym order (list ≡ detail).
	const staleStair = exerciseName(
		{
			id: '__no_override__',
			name: 'standing calf raise (on a staircase)',
			name_ru: 'Стоя подъём на носки (по лестнице)'
		},
		'ru'
	);
	if (staleStair !== 'Подъём на носки стоя (по лестнице)') {
		throw new Error(`stale stair calque → «${staleStair}»`);
	}
	const staleFloor = exerciseName(
		{ id: '__no_override__', name: 'barbell floor calf raise', name_ru: 'На полу подъём на носки со штангой' },
		'ru'
	);
	if (staleFloor !== 'Подъём на носки со штангой на полу') {
		throw new Error(`stale floor calque → «${staleFloor}»`);
	}

	const stair = index.find((item) => item.id === '1490');
	if (!stair || exerciseName(stair, 'ru') !== 'Подъём на носки стоя (по лестнице)') {
		throw new Error(`1490 should be staircase calf raise, got ${stair ? exerciseName(stair, 'ru') : 'missing'}`);
	}
	const bandTwo = index.find((item) => item.id === '1369');
	if (
		!bandTwo ||
		exerciseName(bandTwo, 'ru') !== 'Подъём на носки с резинкой двумя ногами (другой ракурс)'
	) {
		throw new Error(`1369 band two-leg calf → «${bandTwo ? exerciseName(bandTwo, 'ru') : 'missing'}»`);
	}
}

runExerciseNameSelfCheck();
console.log('exerciseName self-check ok');
