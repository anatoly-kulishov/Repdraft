#!/usr/bin/env node
/**
 * Generate a Repdraft backup JSON for UI stress / edge-case restore tests.
 *
 * Mixes realistic workout names with deliberate overflow rows (long text,
 * WEIGHT/REPS/SETS ceilings, supersets, skips, nulls, tiny/huge durations).
 *
 * Usage:
 *   node scripts/gen-stress-backup.mjs
 *   node scripts/gen-stress-backup.mjs --sessions 1200 --plans 80 --out .tmp/big.json
 *
 * Import: Profile → Restore from file → pick the JSON.
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

const PLAN_COUNT = Number(arg('plans', '60'));
const SESSION_COUNT = Number(arg('sessions', '750'));
const RECORD_COUNT = Number(arg('records', '400'));
const outPath = resolve(root, arg('out', '.tmp/repdraft-backup-stress-load.json'));

const index = JSON.parse(readFileSync(join(root, 'static/data/exercises.index.json'), 'utf8'));
const EX_IDS = (Array.isArray(index) ? index : [])
	.map((row) => row.id)
	.filter((id) => typeof id === 'string' && id.length > 0);

if (EX_IDS.length < 50) {
	console.error('Need exercises.index.json with enough ids');
	process.exit(1);
}

function pickId(i) {
	return EX_IDS[((i % EX_IDS.length) + EX_IDS.length) % EX_IDS.length];
}

function isoDaysAgo(days, hour = 10, minute = 0) {
	const d = new Date();
	d.setUTCDate(d.getUTCDate() - days);
	d.setUTCHours(hour, minute, 0, 0);
	return d.toISOString();
}

function addMinutes(iso, minutes) {
	return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

/** Meaningful program names (RU/EN) — most of the list stays readable. */
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
	'Олимпийский рывок (лёгкий)',
	'Становая тяга · техника',
	'Присед со штангой',
	'Жим стоя + жим лёжа',
	'Тяга блока к поясу',
	'Разгибания ног / сгибания',
	'Гиперэкстензия + RDL',
	'Кроссовер и разведения',
	'Подтягивания / австралийские',
	'Отжимания на брусьях',
	'Икры стоя / сидя',
	'Предплечья и хват',
	'Мобилити + активация',
	'Делoad 60%',
	'AMRAP грудь 20′',
	'EMOM спина',
	'Кластер-сеты на жим',
	'Пирамида на присед',
	'Суперсеты грудь/спина',
	'Трисет плечи',
	'Домашний комплекс',
	'Зал: только гантели',
	'Тренажёры full',
	'Свободные веса only',
	'Утро: верхняя часть',
	'Вечер: ноги',
	'Сплит Пн/Ср/Пт A',
	'Сплит Вт/Чт/Сб B',
	'Восстановление + кардио',
	'Техника жима узким хватом'
];

/**
 * Named edge plans injected by index so overflow is easy to find in UI.
 * Indices wrap if PLAN_COUNT is smaller than the largest edge index.
 */
const EDGE_PLANS = [
	{
		at: 0,
		name:
			'Перегруз названия · жим / тяга / присед · ' +
			'очень длинная строка для проверки переноса и обрезки в карточках, шапке live и истории ' +
			'ж'.repeat(48) +
			' · #EDGE-LONG',
		size: 8,
		mode: 'superset'
	},
	{
		at: 1,
		name: 'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
		size: 4,
		mode: 'plain'
	},
	{
		at: 2,
		name: '一二三四五六七八九十・カタカナ・한글・Mixed Script Overflow Title',
		size: 5,
		mode: 'plain'
	},
	{
		at: 3,
		name: '0',
		size: 1,
		mode: 'single'
	},
	{
		at: 4,
		name: 'Максимум подходов (99) · один слот',
		size: 1,
		mode: 'max-sets'
	},
	{
		at: 5,
		name: 'Гигант-сет ×6 + альт-пара',
		size: 8,
		mode: 'giant-alt'
	},
	{
		at: 6,
		name: 'Много упражнений · 18 слотов для скролла live',
		size: 18,
		mode: 'plain'
	},
	{
		at: 7,
		name: '   пробелы   в   начале   и   конце   ',
		size: 3,
		mode: 'plain'
	},
	{
		at: 8,
		name: 'emoji 🏋️💪🔥 · длинный заголовок тренировки для UI',
		size: 5,
		mode: 'plain'
	},
	{
		at: 9,
		name: 'Короткий',
		size: 2,
		mode: 'plain'
	}
];

function edgeAt(i) {
	return EDGE_PLANS.find((e) => e.at === i) ?? null;
}

function buildExercises(i, size, mode) {
	const exercises = [];
	for (let ei = 0; ei < size; ei++) {
		const base = {
			exerciseId: pickId(i * 17 + ei * 5),
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
	const size = edge ? edge.size : 4 + (i % 7);
	const mode = edge ? edge.mode : 'plain';
	const createdAt = isoDaysAgo(400 - i);
	plans.push({
		id: `stress-plan-${String(i).padStart(3, '0')}`,
		name,
		createdAt,
		updatedAt: isoDaysAgo(Math.max(0, 90 - (i % 90))),
		exercises: buildExercises(i, size, mode)
	});
}

/**
 * Session edge patterns by index modulo — dense coverage without making every row insane.
 * @param {number} i
 * @param {import('../src/lib/domain/types').WorkoutPlan} plan
 */
function buildSession(i, plan) {
	const dayOffset = Math.floor(i / 2);
	const startedAt = isoDaysAgo(dayOffset, 8 + (i % 10), (i * 7) % 60);
	const pattern = i % 17;

	let finishedAt;
	let exCount;
	let planId = plan.id;
	let planName = plan.name;

	switch (pattern) {
		case 0: // ultra-short (0–1 min) — history meta edge
			finishedAt = addMinutes(startedAt, i % 2 === 0 ? 0 : 1);
			exCount = 1;
			break;
		case 1: // marathon duration
			finishedAt = addMinutes(startedAt, 8 * 60 + (i % 40));
			exCount = Math.min(plan.exercises.length, 10);
			break;
		case 2: // unfinished (active-like in history merge — finishedAt null)
			finishedAt = null;
			exCount = Math.min(plan.exercises.length, 3);
			break;
		case 3: // orphan / deleted plan
			planId = null;
			planName =
				'Сессия без плана · ' +
				'удалённый шаблон с длинным именем '.repeat(4) +
				`#${i}`;
			finishedAt = addMinutes(startedAt, 42);
			exCount = 3;
			break;
		case 4: // stale planName vs plan (rename race)
			planName = plan.name + ' [старое имя до переименования · ' + 'ж'.repeat(20) + ']';
			finishedAt = addMinutes(startedAt, 50);
			exCount = Math.min(plan.exercises.length, 6);
			break;
		case 5: // use edge max-sets plan content heavily
			finishedAt = addMinutes(startedAt, 95);
			exCount = Math.min(plan.exercises.length, 4);
			break;
		default:
			finishedAt = addMinutes(startedAt, 35 + (i % 55));
			exCount = Math.min(plan.exercises.length, 3 + (i % 6));
			break;
	}

	const slice = plan.exercises.slice(0, Math.max(1, exCount));
	const sessionExercises = slice.map((ex, ei) => {
		let setCount = Math.max(1, Math.min(ex.sets, pattern === 5 && ei === 0 ? SETS_MAX : ex.sets));
		if (pattern === 6 && ei === 0) setCount = Math.min(SETS_MAX, 24);
		if (pattern === 0) setCount = 1;

		const sets = Array.from({ length: setCount }, (_, si) => {
			/** @type {import('../src/lib/domain/types').LoggedSet} */
			const set = {
				weightKg: 40 + ((i + ei + si) % 60) + (si % 2 === 0 ? 0.5 : 0),
				reps: Math.max(1, (ex.reps || 8) - (si % 3)),
				completed: true,
				kind: 'work'
			};

			if (pattern === 7 && si === 0) {
				set.kind = 'warmup';
				set.weightKg = 20;
				set.reps = 12;
			} else if (pattern === 7 && si === setCount - 1 && setCount > 2) {
				set.kind = 'drop';
				set.weightKg = Math.max(0, (set.weightKg ?? 40) - 15);
			}

			if (pattern === 8 && si === 0) {
				set.weightKg = WEIGHT_MAX;
				set.reps = REPS_MAX;
			}
			if (pattern === 9 && si === 0) {
				set.weightKg = 0;
				set.reps = 0;
			}
			if (pattern === 10 && si === 1) {
				set.weightKg = null;
				set.reps = null;
				set.completed = false;
			}
			if (pattern === 11 && si === setCount - 1) {
				set.completed = false;
				set.weightKg = 55.5;
				set.reps = 3;
			}
			if (pattern === 12 && ei === 0 && si === 0) {
				set.weightKg = 0.5;
				set.reps = 1;
			}

			return set;
		});

		return {
			exerciseId: ex.exerciseId,
			groupId: ex.groupId ?? null,
			altGroupId: ex.altGroupId ?? null,
			targetSets: setCount,
			targetReps: pattern === 8 ? REPS_MAX : ex.reps,
			restSec: pattern === 5 ? REST_MAX : ex.restSec,
			sets,
			skipped: pattern === 13 && ei === slice.length - 1
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
	const plan = plans[i % plans.length];
	sessions.push(buildSession(i, plan));
}

/** @type {import('../src/lib/domain/types').PersonalRecord[]} */
const records = [];
const seen = new Set();
for (let i = 0; i < RECORD_COUNT * 2 && records.length < RECORD_COUNT; i++) {
	const exerciseId = pickId(i * 5 + 1);
	if (seen.has(exerciseId)) continue;
	seen.add(exerciseId);
	const r = records.length;
	const pattern = r % 13;

	let weightKg = 40 + (r % 120);
	let reps = 5 + (r % 12);
	let note = '';

	switch (pattern) {
		case 0:
			weightKg = WEIGHT_MAX;
			reps = REPS_MAX;
			note =
				'Максимум веса и повторов · ' +
				'заметка на всю ширину карточки рекорда '.repeat(6) +
				'ж'.repeat(64);
			break;
		case 1:
			weightKg = null;
			reps = REPS_MAX;
			note = 'Только повторы, вес пустой';
			break;
		case 2:
			weightKg = WEIGHT_MAX;
			reps = null;
			note = 'Только вес, повторы пустые';
			break;
		case 3:
			weightKg = null;
			reps = null;
			note = 'Пустой PR · только заметка ' + 'x'.repeat(80);
			break;
		case 4:
			weightKg = 0.5;
			reps = 1;
			note = 'Минимум: 0.5 кг × 1';
			break;
		case 5:
			weightKg = 100;
			reps = 1;
			note = '';
			break;
		case 6:
			note = '🏋️ PR note with emoji and mixed RU/EN overflow for the records sheet';
			break;
		case 7:
			note = 'belt · straps · chalk';
			break;
		default:
			if (r % 9 === 0) note = 'paused at knees';
			break;
	}

	records.push({
		exerciseId,
		weightKg,
		reps,
		note,
		updatedAt: isoDaysAgo(r % 200)
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
const json = `${JSON.stringify(payload, null, 2)}\n`;
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

const edgeNames = EDGE_PLANS.map((e) => plans[e.at]?.name?.slice(0, 40)).filter(Boolean);
const mb = (Buffer.byteLength(json) / (1024 * 1024)).toFixed(2);
console.log(`Wrote ${outPath}`);
console.log(`Wrote ${staticDevOut} (profile QA button)`);
console.log(
	`plans=${plans.length} sessions=${sessions.length} records=${records.length} size=${mb} MiB`
);
console.log(`edge plans: ${edgeNames.join(' | ')}`);
console.log('App: Profile → Load stress backup.');
