#!/usr/bin/env node
/**
 * Generate a Repdraft backup JSON for UI stress / edge-case restore tests.
 *
 * Mostly realistic gym data (RU program names, plausible weights, ~4 sessions/week)
 * plus a fixed set of #EDGE rows for overflow / null / max ceilings.
 *
 * Usage:
 *   npm run gen:stress-backup
 *   node scripts/gen-stress-backup.mjs --sessions 2000 --plans 120 --out .tmp/big.json
 *
 * Defaults target weak-phone list stress (plans scroll/reorder + history pagination).
 * Default output is also written to static/dev/ (shipped for staging QA).
 *
 * Caution: importing while cloud sync is on will upsert into Supabase - wipe local
 * or stay logged out for QA, or clear cloud rows after (see release / ops notes).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXPORT_VERSION = 1;

/** Mirror src/lib/domain/inputLimits.ts ceilings so restore stays within UI bounds. */
const WEIGHT_MAX = 999;
const REPS_MAX = 999;
const SETS_MAX = 99;
const REST_MAX = 999;

function arg(name, fallback) {
	const i = process.argv.indexOf(`--${name}`);
	if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
	return fallback;
}

const PLAN_COUNT = Number(arg('plans', '96'));
const SESSION_COUNT = Number(arg('sessions', '1400'));
const RECORD_COUNT = Number(arg('records', '480'));
const outPath = resolve(root, arg('out', '.tmp/repdraft-backup-stress-load.json'));

const index = JSON.parse(readFileSync(join(root, 'static/data/exercises.index.json'), 'utf8'));
const EXERCISES = (Array.isArray(index) ? index : []).filter(
	(row) => row && typeof row.id === 'string' && row.id.length > 0
);

if (EXERCISES.length < 50) {
	console.error('Need exercises.index.json with enough ids');
	process.exit(1);
}

const byEquip = {
	barbell: [],
	dumbbell: [],
	cable: [],
	machine: [],
	body: [],
	other: []
};
for (const ex of EXERCISES) {
	const eq = String(ex.equipment || '').toLowerCase();
	if (eq.includes('barbell')) byEquip.barbell.push(ex);
	else if (eq.includes('dumbbell')) byEquip.dumbbell.push(ex);
	else if (eq.includes('cable')) byEquip.cable.push(ex);
	else if (eq.includes('leverage machine') || eq.includes('smith')) byEquip.machine.push(ex);
	else if (eq.includes('body weight') || eq === 'body weight') byEquip.body.push(ex);
	else byEquip.other.push(ex);
}

function pickFrom(pool, i) {
	const list = pool.length > 0 ? pool : EXERCISES;
	return list[((i % list.length) + list.length) % list.length];
}

function pickId(i, prefer = 'mixed') {
	if (prefer === 'barbell') return pickFrom(byEquip.barbell, i).id;
	if (prefer === 'dumbbell') return pickFrom(byEquip.dumbbell, i).id;
	if (prefer === 'cable') return pickFrom(byEquip.cable, i).id;
	if (prefer === 'machine') return pickFrom(byEquip.machine, i).id;
	if (prefer === 'body') return pickFrom(byEquip.body, i).id;
	const pools = [byEquip.barbell, byEquip.dumbbell, byEquip.cable, byEquip.machine, byEquip.body];
	return pickFrom(pools[i % pools.length], i).id;
}

function isoDaysAgoLocal(days, hour = 10, minute = 0) {
	const d = new Date();
	d.setHours(0, 0, 0, 0);
	d.setDate(d.getDate() - days);
	d.setHours(hour, minute, 0, 0);
	return d.toISOString();
}

function addMinutes(iso, minutes) {
	return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

/** Typical working weights by equipment family (kg). */
function realisticWeight(exerciseId, setIndex, seed) {
	const ex = EXERCISES.find((e) => e.id === exerciseId);
	const eq = String(ex?.equipment || '').toLowerCase();
	const body = String(ex?.body_part || '').toLowerCase();
	let base = 30 + (seed % 40);
	if (eq.includes('barbell')) {
		if (body.includes('legs') || body.includes('glutes')) base = 60 + (seed % 80);
		else if (body.includes('back')) base = 50 + (seed % 70);
		else if (body.includes('chest')) base = 45 + (seed % 55);
		else base = 30 + (seed % 50);
	} else if (eq.includes('dumbbell')) {
		base = 10 + (seed % 28);
	} else if (eq.includes('cable') || eq.includes('machine')) {
		base = 20 + (seed % 45);
	} else if (eq.includes('body')) {
		base = 0;
	}
	const kg = Math.max(0, base - setIndex * (eq.includes('dumbbell') ? 2 : 2.5));
	return Math.round(kg * 2) / 2;
}

const REAL_PLAN_NAMES = [
	'Жим лёжа · силовая',
	'Тяга + задняя дельта',
	'Ноги: присед и задняя поверхность',
	'Верх: жим и разведения',
	'Полное тело A (3×10)',
	'Руки: бицепс / трицепс',
	'Плечи: жим + махи',
	'Грудь: гипертрофия',
	'Спина: ширина и толщина',
	'Ягодицы и задняя цепь',
	'Push (горизонтальный акцент)',
	'Pull (вертикальный акцент)',
	'Legs · квадрицепс',
	'Upper body power',
	'Full body B',
	'Arms pump 45′',
	'Shoulders & traps',
	'Chest press focus',
	'Back strength day',
	'Core + carries',
	'Становая тяга · техника',
	'Присед со штангой',
	'Жим стоя + жим лёжа',
	'Тяга блока к поясу',
	'Разгибания / сгибания ног',
	'Гиперэкстензия + RDL',
	'Кроссовер и разведения',
	'Подтягивания / австралийские',
	'Отжимания на брусьях',
	'Икры стоя / сидя',
	'Мобилити + активация',
	'Deload 60%',
	'Суперсеты грудь/спина',
	'Трисет плечи',
	'Домашний комплекс',
	'Зал: только гантели',
	'Свободные веса only',
	'Утро: верхняя часть',
	'Вечер: ноги',
	'Сплит Пн/Ср/Пт A',
	'Сплит Вт/Чт/Сб B',
	'Восстановление + лёгкий объём',
	'Спина + бицепс',
	'Грудь + трицепс',
	'Ноги тяжёлые',
	'Ноги объём',
	'Плечи изоляция',
	'Тяговый день',
	'Жимовой день',
	'Full body C · 45 мин',
	'Upper / Lower A',
	'Upper / Lower B',
	'PPL Push',
	'PPL Pull',
	'PPL Legs',
	'Силовая пятница',
	'Техника воскресенье',
	'Кардио + кор',
	'Зал без штанги',
	'Только тросы',
	'Машины / тренажёры',
	'Олимпийские тяги intro',
	'RDL + задняя цепь',
	'Присед + выпады',
	'Жим гантелей фокус',
	'Тяга в наклоне фокус',
	'Руки finisher',
	'Шея / трапеции',
	'Предплечья + хват',
	'Мобилити бёдер',
	'Разминка + лёгкий объём',
	'Соревновательный пик',
	'После отпуска · возврат',
	'Минимальный зал (3 упражнения)',
	'Длинная сессия 90′',
	'Обед 30′ pump',
	'Вечер: верх + кор',
	'Утро: ноги + икры',
	'Сплит Пн/Чт грудь',
	'Сплит Ср/Сб спина',
	'Сплит Вт/Пт ноги',
	'Гипертрофия блок 1',
	'Гипертрофия блок 2',
	'Сила блок 1',
	'Сила блок 2',
	'Кондиция + ОФП',
	'Реабилитация плеча (лёгко)',
	'Только дома: резинки',
	'Парная тренировка',
	'Solo · полный зал'
];

const EDGE_PLANS = [
	{
		at: 0,
		name:
			'#EDGE-LONG · перегруз названия · жим / тяга / присед · ' +
			'очень длинная строка для проверки переноса в карточках, live и истории ' +
			'ж'.repeat(48),
		size: 8,
		mode: 'superset',
		prefer: 'barbell'
	},
	{
		at: 1,
		name: '#EDGE-WWWW · WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
		size: 4,
		mode: 'plain',
		prefer: 'dumbbell'
	},
	{
		at: 2,
		name: '#EDGE-CJK · 一二三四五六七八九十・カタカナ・한글 · Mixed',
		size: 5,
		mode: 'plain',
		prefer: 'cable'
	},
	{ at: 3, name: '#EDGE-MIN · 0', size: 1, mode: 'single', prefer: 'body' },
	{
		at: 4,
		name: '#EDGE-MAX-SETS · 99 подходов',
		size: 1,
		mode: 'max-sets',
		prefer: 'machine'
	},
	{
		at: 5,
		name: '#EDGE-GIANT · гигант-сет ×6 + альт-пара',
		size: 8,
		mode: 'giant-alt',
		prefer: 'barbell'
	},
	{
		at: 6,
		name: '#EDGE-SCROLL · 18 слотов для скролла live',
		size: 18,
		mode: 'plain',
		prefer: 'mixed'
	},
	{
		at: 7,
		name: '   #EDGE-SPACES   пробелы   вокруг   ',
		size: 3,
		mode: 'plain',
		prefer: 'dumbbell'
	},
	{
		at: 8,
		name: '#EDGE-EMOJI 🏋️💪🔥 · длинный заголовок',
		size: 5,
		mode: 'plain',
		prefer: 'barbell'
	},
	{ at: 9, name: '#EDGE-SHORT', size: 2, mode: 'plain', prefer: 'body' }
];

function edgeAt(i) {
	return EDGE_PLANS.find((e) => e.at === i) ?? null;
}

function buildExercises(i, size, mode, prefer) {
	const exercises = [];
	for (let ei = 0; ei < size; ei++) {
		const base = {
			exerciseId: pickId(i * 17 + ei * 5, prefer),
			sets: 3 + (ei % 3),
			reps: 6 + (ei % 7),
			restSec: 60 + (ei % 5) * 30,
			groupId: null,
			altGroupId: null
		};

		switch (mode) {
			case 'superset':
				if (ei < 2) base.groupId = `ss-${i}`;
				break;
			case 'giant-alt':
				if (ei < 6) base.groupId = `giant-${i}`;
				if (ei >= 6) {
					base.altGroupId = `alt-${i}`;
					base.sets = 4;
				}
				break;
			case 'max-sets':
				base.sets = SETS_MAX;
				base.reps = REPS_MAX;
				base.restSec = REST_MAX;
				break;
			case 'single':
				base.sets = 1;
				base.reps = 1;
				base.restSec = 0;
				break;
			default:
				if (ei < 2 && i % 7 === 0) base.groupId = `g-${i}`;
				if (ei >= size - 2 && i % 11 === 0) base.altGroupId = `a-${i}`;
				break;
		}

		exercises.push(base);
	}
	return exercises;
}

/** @type {import('../src/lib/domain/types').WorkoutPlan[]} */
const plans = [];
for (let i = 0; i < PLAN_COUNT; i++) {
	const edge = edgeAt(i);
	const name = edge
		? edge.name
		: REAL_PLAN_NAMES[i % REAL_PLAN_NAMES.length] +
			(i >= REAL_PLAN_NAMES.length ? ` · v${Math.floor(i / REAL_PLAN_NAMES.length) + 1}` : '');
	/* Mix short / medium / long templates so builder + live scroll get real stress. */
	const size = edge ? edge.size : i % 9 === 0 ? 12 : i % 5 === 0 ? 8 : 4 + (i % 5);
	const mode = edge ? edge.mode : i % 13 === 0 ? 'superset' : 'plain';
	const prefer = edge?.prefer ?? (i % 3 === 0 ? 'barbell' : i % 3 === 1 ? 'dumbbell' : 'mixed');
	const createdAt = isoDaysAgoLocal(720 - Math.min(i * 5, 700));
	plans.push({
		id: `stress-plan-${String(i).padStart(3, '0')}`,
		name,
		createdAt,
		updatedAt: isoDaysAgoLocal(Math.max(0, 90 - (i % 90))),
		exercises: buildExercises(i, size, mode, prefer)
	});
}

/**
 * Map session index → calendar day offset so history looks like ~4 training days/week,
 * with occasional doubles (morning + evening).
 */
function sessionDayOffset(i) {
	const week = Math.floor(i / 5);
	const slot = i % 5;
	const dayInWeek = [0, 1, 3, 4, 5][slot];
	return week * 7 + dayInWeek;
}

/**
 * @param {number} i
 * @param {import('../src/lib/domain/types').WorkoutPlan} plan
 */
function buildSession(i, plan) {
	const dayOffset = sessionDayOffset(i);
	const evening = i % 5 === 4 && i % 10 === 4;
	const startedAt = isoDaysAgoLocal(dayOffset, evening ? 19 : 9 + (i % 3), (i * 11) % 50);
	/** Sparse edges: ~1/24 sessions; rest look like normal gym logs. */
	const edgeKind = i % 24 === 0 ? (i / 24) % 12 : -1;

	let finishedAt = addMinutes(startedAt, 42 + (i % 38));
	let exCount = Math.min(plan.exercises.length, 3 + (i % 4));
	let planId = plan.id;
	let planName = plan.name;

	switch (edgeKind) {
		case 0:
			finishedAt = addMinutes(startedAt, i % 2 === 0 ? 0 : 1);
			exCount = 1;
			break;
		case 1:
			finishedAt = addMinutes(startedAt, 8 * 60 + (i % 40));
			exCount = Math.min(plan.exercises.length, 10);
			break;
		case 2:
			finishedAt = null;
			exCount = Math.min(plan.exercises.length, 2);
			break;
		case 3:
			planId = null;
			planName = '#EDGE-ORPHAN · сессия без плана · ' + 'удалённый шаблон '.repeat(3) + `#${i}`;
			finishedAt = addMinutes(startedAt, 42);
			exCount = 3;
			break;
		case 4:
			planName = plan.name + ' [старое имя · ' + 'ж'.repeat(16) + ']';
			break;
		case 5:
			finishedAt = addMinutes(startedAt, 95);
			exCount = Math.min(plan.exercises.length, 4);
			break;
		default:
			break;
	}

	const slice = plan.exercises.slice(0, Math.max(1, exCount));
	const sessionExercises = slice.map((ex, ei) => {
		let setCount = Math.max(1, Math.min(ex.sets, edgeKind === 5 && ei === 0 ? SETS_MAX : ex.sets));
		if (edgeKind === 6 && ei === 0) setCount = Math.min(SETS_MAX, 24);
		if (edgeKind === 0) setCount = 1;

		const sets = Array.from({ length: setCount }, (_, si) => {
			/** @type {import('../src/lib/domain/types').LoggedSet} */
			const set = {
				weightKg: realisticWeight(ex.exerciseId, si, i * 13 + ei * 3),
				reps: Math.max(1, (ex.reps || 8) - (si % 3)),
				completed: true,
				kind: 'work'
			};

			if (edgeKind === 7 && si === 0) {
				set.kind = 'warmup';
				set.weightKg = Math.max(0, (set.weightKg ?? 40) * 0.4);
				set.reps = 12;
			} else if (edgeKind === 7 && si === setCount - 1 && setCount > 2) {
				set.kind = 'drop';
				set.weightKg = Math.max(0, (set.weightKg ?? 40) - 15);
			}

			if (edgeKind === 8 && si === 0) {
				set.weightKg = WEIGHT_MAX;
				set.reps = REPS_MAX;
			}
			if (edgeKind === 9 && si === 0) {
				set.weightKg = 0;
				set.reps = 0;
			}
			if (edgeKind === 10 && si === 1) {
				set.weightKg = null;
				set.reps = null;
				set.completed = false;
			}
			if (edgeKind === 11 && si === setCount - 1) {
				set.completed = false;
			}

			return set;
		});

		return {
			exerciseId: ex.exerciseId,
			groupId: ex.groupId ?? null,
			altGroupId: ex.altGroupId ?? null,
			targetSets: setCount,
			targetReps: edgeKind === 8 ? REPS_MAX : ex.reps,
			restSec: edgeKind === 5 ? REST_MAX : ex.restSec,
			sets,
			skipped: edgeKind === 6 && ei === slice.length - 1
		};
	});

	/** @type {import('../src/lib/domain/types').WorkoutSession} */
	const session = {
		id: `stress-session-${String(i).padStart(4, '0')}`,
		planId,
		planName,
		startedAt,
		finishedAt,
		exercises: sessionExercises
	};

	const altIds = plan.exercises.filter((e) => e.altGroupId).map((e) => e.altGroupId);
	if (altIds.length > 0) {
		const firstAlt = altIds[0];
		const choice = plan.exercises.find((e) => e.altGroupId === firstAlt);
		if (choice) {
			session.altChoices = { [firstAlt]: choice.exerciseId };
		}
	}

	return session;
}

/** @type {import('../src/lib/domain/types').WorkoutSession[]} */
const sessions = [];
for (let i = 0; i < SESSION_COUNT; i++) {
	/* Spread history across the full plan library (not only the first 10 edge plans). */
	const planIdx =
		i % 17 === 0
			? i % Math.min(EDGE_PLANS.length, plans.length)
			: (i * 7 + 13) % plans.length;
	sessions.push(buildSession(i, plans[planIdx] ?? plans[0]));
}

const SHORT_NOTES = [
	'',
	'',
	'',
	'пояс',
	'лямки',
	'пауза внизу',
	'без отбива',
	'лёгкий день',
	'PR attempt',
	'техника'
];

/** @type {import('../src/lib/domain/types').PersonalRecord[]} */
const records = [];
const seen = new Set();
for (let i = 0; i < RECORD_COUNT * 3 && records.length < RECORD_COUNT; i++) {
	const prefer = i % 4 === 0 ? 'barbell' : i % 4 === 1 ? 'dumbbell' : 'mixed';
	const exerciseId = pickId(i * 5 + 1, prefer);
	if (seen.has(exerciseId)) continue;
	seen.add(exerciseId);
	const r = records.length;
	const edge = r < 8;

	let weightKg = realisticWeight(exerciseId, 0, r * 7);
	let reps = 3 + (r % 8);
	let note = SHORT_NOTES[r % SHORT_NOTES.length];

	if (edge) {
		switch (r) {
			case 0:
				weightKg = WEIGHT_MAX;
				reps = REPS_MAX;
				note = '#EDGE-PR-MAX · ' + 'заметка на всю ширину '.repeat(5) + 'ж'.repeat(48);
				break;
			case 1:
				weightKg = null;
				reps = REPS_MAX;
				note = '#EDGE · только повторы';
				break;
			case 2:
				weightKg = WEIGHT_MAX;
				reps = null;
				note = '#EDGE · только вес';
				break;
			case 3:
				weightKg = null;
				reps = null;
				note = '#EDGE · пустой PR ' + 'x'.repeat(64);
				break;
			case 4:
				weightKg = 0.5;
				reps = 1;
				note = '#EDGE · 0.5 кг × 1';
				break;
			case 5:
				note = '#EDGE 🏋️ mixed RU/EN overflow for records sheet';
				break;
			case 6:
				note = 'belt · straps · chalk';
				break;
			default:
				weightKg = 100;
				reps = 1;
				note = '';
				break;
		}
	}

	records.push({
		exerciseId,
		weightKg,
		reps,
		note,
		updatedAt: isoDaysAgoLocal(r % 180)
	});
}

const payload = {
	version: EXPORT_VERSION,
	exportedAt: new Date().toISOString(),
	plans,
	sessions,
	records
};

mkdirSync(dirname(outPath), { recursive: true });
/* Compact JSON: smaller deploy artifact for staging. */
const json = `${JSON.stringify(payload)}\n`;
writeFileSync(outPath, json, 'utf8');

const staticDevOut = join(root, 'static/dev/repdraft-backup-stress-load.json');
mkdirSync(dirname(staticDevOut), { recursive: true });
writeFileSync(staticDevOut, json, 'utf8');

function ok() {
	if (payload.version !== 1) return false;
	if (!Array.isArray(payload.plans) || !Array.isArray(payload.sessions) || !Array.isArray(payload.records))
		return false;
	const p = payload.plans[0];
	const s = payload.sessions[0];
	const r = payload.records[0];
	return Boolean(p?.id && s?.id && r?.exerciseId);
}

if (!ok()) {
	console.error('Generated payload failed basic validation');
	process.exit(1);
}

const edgeNames = EDGE_PLANS.map((e) => plans[e.at]?.name?.slice(0, 48)).filter(Boolean);
const mb = (Buffer.byteLength(json) / (1024 * 1024)).toFixed(2);
console.log(`Wrote ${outPath}`);
console.log(`Wrote ${staticDevOut} (profile QA button / staging)`);
console.log(
	`plans=${plans.length} sessions=${sessions.length} records=${records.length} size=${mb} MiB`
);
console.log(`edge plans: ${edgeNames.join(' | ')}`);
console.log('App: Profile → Load test backup.');
