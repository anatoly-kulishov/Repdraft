/**
 * Public program library: 4-week blocks built *from the catalog by rules*, not
 * from a hand-written list of exercise ids. Two reasons:
 *
 * 1. No drift — if the catalog is rebuilt (ids change), programs still work.
 * 2. Low-end friendly — a session is 4–5 exercises, nothing to download.
 *
 * Programs are content (weeks × sessions), the plan itself is generated on the
 * client from the local catalog index, then saved through `plans.importPlan`,
 * so a program session behaves exactly like a hand-built plan.
 */

import type { BodyPart, ExerciseIndexItem, WorkoutExercise } from './types';

export type ProgramLevel = 'novice' | 'intermediate';

export type ProgramFocusSlot = {
	bodyPart: BodyPart;
	/** Catalog `target` (e.g. `glutes`); null = any target of that body part. */
	target: string | null;
	slots: number;
};

export type ProgramSessionTemplate = {
	id: string;
	titleRu: string;
	titleEn: string;
	focus: ProgramFocusSlot[];
	sets: number;
	reps: number;
	restSec: number;
};

export type ProgramTemplate = {
	slug: string;
	titleRu: string;
	titleEn: string;
	/** Plan-list name: the full title does not fit `PLAN_NAME_MAX`. */
	shortRu: string;
	shortEn: string;
	leadRu: string;
	leadEn: string;
	level: ProgramLevel;
	weeks: number;
	/** One week of sessions; later weeks repeat it with progression. */
	sessions: ProgramSessionTemplate[];
};

export type ProgramSessionPrescription = { sets: number; reps: number; restSec: number };

export type ProgramWeek = {
	index: number;
	sessions: ProgramSessionTemplate[];
};

export const PROGRAMS_HUB_PATH = '/programs';

/** Local-only progress: which saved plan belongs to which week/session slot. */
export const PROGRAM_RUNS_STORAGE_KEY = 'repdraft:program-runs';

export function programPath(slug: string): string {
	return `${PROGRAMS_HUB_PATH}/${slug}`;
}

export function programTitle(program: ProgramTemplate, locale: 'ru' | 'en'): string {
	return locale === 'ru' ? program.titleRu : program.titleEn;
}

export function programLead(program: ProgramTemplate, locale: 'ru' | 'en'): string {
	return locale === 'ru' ? program.leadRu : program.leadEn;
}

export function programShortName(program: ProgramTemplate, locale: 'ru' | 'en'): string {
	return locale === 'ru' ? program.shortRu : program.shortEn;
}

export function sessionTitle(session: ProgramSessionTemplate, locale: 'ru' | 'en'): string {
	return locale === 'ru' ? session.titleRu : session.titleEn;
}

/* ——— Content (copy lives here: two short programs, four weeks each) ——— */

export const PROGRAMS: readonly ProgramTemplate[] = [
	{
		slug: 'full-body-3x',
		titleRu: 'Всё тело 3 раза в неделю',
		titleEn: 'Full body 3× a week',
		shortRu: 'Всё тело 3×',
		shortEn: 'Full body 3×',
		leadRu:
			'Четыре недели по три тренировки: ноги, жимы и тяги в каждой сессии. База для первого месяца в зале.',
		leadEn:
			'Four weeks, three sessions: legs, a push and a pull every time. The base for your first month in the gym.',
		level: 'novice',
		weeks: 4,
		sessions: [
			{
				id: 'a',
				titleRu: 'A · Ноги, грудь, спина',
				titleEn: 'A · Legs, chest, back',
				focus: [
					{ bodyPart: 'upper legs', target: null, slots: 2 },
					{ bodyPart: 'chest', target: null, slots: 1 },
					{ bodyPart: 'back', target: null, slots: 1 }
				],
				sets: 3,
				reps: 10,
				restSec: 90
			},
			{
				id: 'b',
				titleRu: 'B · Спина, плечи, пресс',
				titleEn: 'B · Back, shoulders, core',
				focus: [
					{ bodyPart: 'back', target: null, slots: 2 },
					{ bodyPart: 'shoulders', target: null, slots: 1 },
					{ bodyPart: 'waist', target: null, slots: 1 }
				],
				sets: 3,
				reps: 12,
				restSec: 75
			},
			{
				id: 'c',
				titleRu: 'C · Ноги, руки, пресс',
				titleEn: 'C · Legs, arms, core',
				focus: [
					{ bodyPart: 'upper legs', target: null, slots: 2 },
					{ bodyPart: 'upper arms', target: null, slots: 1 },
					{ bodyPart: 'waist', target: null, slots: 1 }
				],
				sets: 3,
				reps: 10,
				restSec: 90
			}
		]
	},
	{
		slug: 'upper-lower-4x',
		titleRu: 'Верх / низ 4 раза в неделю',
		titleEn: 'Upper/Lower 4× a week',
		shortRu: 'Верх/низ 4×',
		shortEn: 'Upper/Lower 4×',
		leadRu:
			'Верх и низ по очереди, четыре сессии в неделю. Больше объёма на группу — для тех, кто уже ходит стабильно.',
		leadEn:
			'Alternating upper and lower days, four sessions a week. More volume per muscle for people who already train consistently.',
		level: 'intermediate',
		weeks: 4,
		sessions: [
			{
				id: 'upper-1',
				titleRu: 'Верх · жимы',
				titleEn: 'Upper · push',
				focus: [
					{ bodyPart: 'chest', target: null, slots: 2 },
					{ bodyPart: 'shoulders', target: null, slots: 1 },
					{ bodyPart: 'upper arms', target: null, slots: 1 }
				],
				sets: 4,
				reps: 8,
				restSec: 120
			},
			{
				id: 'lower-1',
				titleRu: 'Низ · приседы',
				titleEn: 'Lower · squat focus',
				focus: [
					{ bodyPart: 'upper legs', target: 'glutes', slots: 2 },
					{ bodyPart: 'upper legs', target: 'quadriceps', slots: 1 },
					{ bodyPart: 'lower legs', target: null, slots: 1 }
				],
				sets: 4,
				reps: 8,
				restSec: 120
			},
			{
				id: 'upper-2',
				titleRu: 'Верх · тяги',
				titleEn: 'Upper · pull',
				focus: [
					{ bodyPart: 'back', target: null, slots: 2 },
					{ bodyPart: 'upper arms', target: 'biceps', slots: 1 },
					{ bodyPart: 'waist', target: null, slots: 1 }
				],
				sets: 4,
				reps: 10,
				restSec: 100
			},
			{
				id: 'lower-2',
				titleRu: 'Низ · задняя цепь',
				titleEn: 'Lower · posterior chain',
				focus: [
					{ bodyPart: 'upper legs', target: 'hamstrings', slots: 2 },
					{ bodyPart: 'upper legs', target: 'glutes', slots: 1 },
					{ bodyPart: 'lower legs', target: null, slots: 1 }
				],
				sets: 3,
				reps: 12,
				restSec: 90
			}
		]
	}
] as const;

export function findProgram(slug: string): ProgramTemplate | null {
	return PROGRAMS.find((program) => program.slug === slug) ?? null;
}

export function programWeeks(program: ProgramTemplate): ProgramWeek[] {
	return Array.from({ length: program.weeks }, (_, index) => ({
		index: index + 1,
		sessions: program.sessions
	}));
}

/**
 * Weekly wave, not a straight line: sets climb in week 3, reps drop in week 4,
 * rest shortens as the body adapts. Same idea as `/cycle`, just inside a block.
 */
export function sessionPrescription(
	session: ProgramSessionTemplate,
	week: number
): ProgramSessionPrescription {
	const safeWeek = Math.min(Math.max(Math.round(week), 1), 12);
	return {
		sets: session.sets + (safeWeek >= 3 ? 1 : 0),
		reps: Math.max(session.reps - (safeWeek >= 4 ? 2 : 0), 4),
		restSec: safeWeek >= 3 ? Math.max(session.restSec - 15, 45) : session.restSec
	};
}

/* ——— Plan generation ——— */

function matchesEquipment(exercise: ExerciseIndexItem, equipment: readonly string[] | null): boolean {
	if (!equipment || equipment.length === 0) return true;
	const value = exercise.equipment.trim().toLowerCase();
	if (value === 'body weight' || value === 'bodyweight') return true;
	return equipment.some((item) => item.trim().toLowerCase() === value);
}

/** Popularity first, then id: stable order means the same session twice in a row. */
function byPopularity(a: ExerciseIndexItem, b: ExerciseIndexItem): number {
	const diff = (b.globalPopularity ?? 0) - (a.globalPopularity ?? 0);
	return diff !== 0 ? diff : a.id.localeCompare(b.id);
}

/**
 * Deterministic pick: no `Math.random`, so a program session is reproducible
 * (and testable) — the user can re-open the plan and see the same exercises.
 */
export function buildSessionExercises(args: {
	session: ProgramSessionTemplate;
	prescription: ProgramSessionPrescription;
	catalog: readonly ExerciseIndexItem[];
	equipment?: readonly string[] | null;
}): WorkoutExercise[] {
	const { session, prescription, catalog, equipment = null } = args;
	const used = new Set<string>();
	const rows: WorkoutExercise[] = [];

	for (const slot of session.focus) {
		const pool = catalog
			.filter(
				(exercise) =>
					exercise.body_part === slot.bodyPart &&
					!used.has(exercise.id) &&
					matchesEquipment(exercise, equipment)
			)
			.sort(byPopularity);
		const exact = slot.target
			? pool.filter((exercise) => exercise.target === slot.target)
			: pool;
		const picked = [...exact, ...pool.filter((exercise) => !exact.includes(exercise))].slice(
			0,
			slot.slots
		);
		for (const exercise of picked) {
			used.add(exercise.id);
			rows.push({
				exerciseId: exercise.id,
				sets: prescription.sets,
				reps: prescription.reps,
				restSec: prescription.restSec
			});
		}
	}

	return rows;
}

/* ——— Progress (local, derived from plans the user actually saved) ——— */

export type ProgramSlotState = {
	planId: string;
	startedAt: string;
	/** Null until a finished session with this planId shows up in history. */
	completedAt: string | null;
};

export type ProgramRun = {
	slug: string;
	startedAt: string;
	/** Key: `${week}:${sessionId}` — one plan per session slot. */
	slots: Record<string, ProgramSlotState>;
};

export function sessionSlotKey(week: number, sessionId: string): string {
	return `${week}:${sessionId}`;
}

export function isSlotDone(
	run: ProgramRun | null | undefined,
	week: number,
	sessionId: string
): boolean {
	return Boolean(run?.slots[sessionSlotKey(week, sessionId)]?.completedAt);
}

export function isSlotStarted(
	run: ProgramRun | null | undefined,
	week: number,
	sessionId: string
): boolean {
	return Boolean(run?.slots[sessionSlotKey(week, sessionId)]);
}

export type ProgramProgressView = {
	done: number;
	total: number;
	percent: number;
	next: { week: number; sessionId: string } | null;
};

export function programProgressView(
	program: ProgramTemplate,
	run: ProgramRun | null | undefined
): ProgramProgressView {
	const total = program.weeks * program.sessions.length;
	let done = 0;
	let next: { week: number; sessionId: string } | null = null;

	for (let week = 1; week <= program.weeks; week++) {
		for (const session of program.sessions) {
			if (isSlotDone(run, week, session.id)) {
				done++;
			} else if (!next) {
				next = { week, sessionId: session.id };
			}
		}
	}

	return { done, total, percent: total > 0 ? Math.round((done / total) * 100) : 0, next };
}

/** Parse guard for the local store: unknown shapes are dropped, never thrown. */
export function parseProgramRuns(raw: unknown): Record<string, ProgramRun> {
	if (!Array.isArray(raw)) return {};
	const result: Record<string, ProgramRun> = {};
	for (const value of raw) {
		if (!value || typeof value !== 'object') continue;
		const run = value as { slug?: unknown; startedAt?: unknown; slots?: unknown };
		if (typeof run.slug !== 'string' || !run.slug.trim() || !findProgram(run.slug)) continue;
		const slots: Record<string, ProgramSlotState> = {};
		if (run.slots && typeof run.slots === 'object' && !Array.isArray(run.slots)) {
			for (const [key, entry] of Object.entries(run.slots as Record<string, unknown>)) {
				const row = entry as { planId?: unknown; startedAt?: unknown; completedAt?: unknown };
				if (typeof row?.planId !== 'string' || !row.planId) continue;
				slots[key] = {
					planId: row.planId,
					startedAt: typeof row.startedAt === 'string' ? row.startedAt : '',
					completedAt: typeof row.completedAt === 'string' ? row.completedAt : null
				};
			}
		}
		result[run.slug] = {
			slug: run.slug,
			startedAt: typeof run.startedAt === 'string' ? run.startedAt : '',
			slots
		};
	}
	return result;
}

/**
 * The only honest completion signal we have without a DB: the saved plan got a
 * finished session. Called when the program page learns local/cloud history.
 */
export function reconcileWithFinishedPlans(
	run: ProgramRun,
	finishedPlanIds: ReadonlySet<string>
): { run: ProgramRun; changed: boolean } {
	const slots = { ...run.slots };
	let changed = false;
	for (const [key, slot] of Object.entries(slots)) {
		if (slot.completedAt) continue;
		if (!finishedPlanIds.has(slot.planId)) continue;
		slots[key] = { ...slot, completedAt: new Date().toISOString() };
		changed = true;
	}
	return { run: changed ? { ...run, slots } : run, changed };
}

/* ——— Self-check (run by scripts/check-domain.mjs) ——— */

function assert(condition: boolean, message: string): void {
	if (!condition) throw new Error(`programs: ${message}`);
}

export function runProgramsSelfCheck(): void {
	const catalog: ExerciseIndexItem[] = [
		{ id: 'l1', name: 'squat', body_part: 'upper legs', equipment: 'barbell', target: 'quadriceps', muscle_group: 'quads', secondary_muscles: [], image: '', globalPopularity: 90 },
		{ id: 'l2', name: 'hip thrust', body_part: 'upper legs', equipment: 'barbell', target: 'glutes', muscle_group: 'glutes', secondary_muscles: [], image: '', globalPopularity: 80 },
		{ id: 'l3', name: 'leg curl', body_part: 'upper legs', equipment: 'machine', target: 'hamstrings', muscle_group: 'hams', secondary_muscles: [], image: '', globalPopularity: 60 },
		{ id: 'l4', name: 'split squat', body_part: 'upper legs', equipment: 'body weight', target: 'quadriceps', muscle_group: 'quads', secondary_muscles: [], image: '', globalPopularity: 70 },
		{ id: 'c1', name: 'bench press', body_part: 'chest', equipment: 'barbell', target: 'pectorals', muscle_group: 'chest', secondary_muscles: [], image: '', globalPopularity: 95 },
		{ id: 'c2', name: 'push-up', body_part: 'chest', equipment: 'body weight', target: 'pectorals', muscle_group: 'chest', secondary_muscles: [], image: '', globalPopularity: 85 },
		{ id: 'b1', name: 'row', body_part: 'back', equipment: 'barbell', target: 'lats', muscle_group: 'back', secondary_muscles: [], image: '', globalPopularity: 90 },
		{ id: 'b2', name: 'pull-up', body_part: 'back', equipment: 'body weight', target: 'lats', muscle_group: 'back', secondary_muscles: [], image: '', globalPopularity: 88 },
		{ id: 's1', name: 'press', body_part: 'shoulders', equipment: 'dumbbell', target: 'delts', muscle_group: 'delts', secondary_muscles: [], image: '', globalPopularity: 75 },
		{ id: 'a1', name: 'curl', body_part: 'upper arms', equipment: 'dumbbell', target: 'biceps', muscle_group: 'biceps', secondary_muscles: [], image: '', globalPopularity: 70 },
		{ id: 'w1', name: 'plank', body_part: 'waist', equipment: 'body weight', target: 'abs', muscle_group: 'abs', secondary_muscles: [], image: '', globalPopularity: 65 }
	];

	assert(PROGRAMS.length >= 2, 'library has programs');
	assert(findProgram('full-body-3x') !== null, 'findProgram');
	assert(findProgram('nope') === null, 'findProgram missing');
	assert(programPath('full-body-3x') === '/programs/full-body-3x', 'programPath');
	assert(programTitle(PROGRAMS[0], 'ru') === PROGRAMS[0].titleRu, 'title ru');
	assert(programTitle(PROGRAMS[0], 'en') === PROGRAMS[0].titleEn, 'title en');
	assert(programShortName(PROGRAMS[0], 'ru') === PROGRAMS[0].shortRu, 'short ru');
	assert(programShortName(PROGRAMS[0], 'en') === PROGRAMS[0].shortEn, 'short en');
	assert(programShortName(PROGRAMS[0], 'ru').length < 20, 'short name fits a plan row');

	const program = PROGRAMS[0];
	assert(programWeeks(program).length === program.weeks, 'weeks expansion');
	assert(programWeeks(program)[3].sessions.length === program.sessions.length, 'sessions per week');

	// Wave: week 1 base, week 3 +1 set & shorter rest, week 4 fewer reps.
	const base = sessionPrescription(program.sessions[0], 1);
	const peak = sessionPrescription(program.sessions[0], 3);
	const deload = sessionPrescription(program.sessions[0], 4);
	assert(base.sets === program.sessions[0].sets, 'week1 sets');
	assert(peak.sets === base.sets + 1, 'week3 +1 set');
	assert(peak.restSec === base.restSec - 15, 'week3 shorter rest');
	assert(deload.reps === Math.max(base.reps - 2, 4), 'week4 fewer reps');
	assert(sessionPrescription(program.sessions[0], 0).sets === base.sets, 'week clamp low');

	// Generation: 4 slots, unique ids, prescription applied.
	const session = program.sessions[0];
	const first = buildSessionExercises({ session, prescription: base, catalog });
	assert(first.length === 4, `4 exercises, got ${first.length}`);
	assert(new Set(first.map((row) => row.exerciseId)).size === first.length, 'unique ids');
	assert(first.every((row) => row.sets === base.sets && row.reps === base.reps), 'prescription applied');
	assert(first[0].exerciseId === 'l1', 'popularity order');

	// Deterministic: same call, same ids.
	const again = buildSessionExercises({ session, prescription: base, catalog });
	assert(again.map((r) => r.exerciseId).join() === first.map((r) => r.exerciseId).join(), 'deterministic');

	// Equipment filter keeps bodyweight and drops machines/barbells.
	const home = buildSessionExercises({
		session,
		prescription: base,
		catalog,
		equipment: ['body weight']
	});
	assert(home.length === 3, `bodyweight picks, got ${home.length}`);
	assert(home.every((row) => ['l4', 'c2', 'b2'].includes(row.exerciseId)), 'bodyweight only');

	// Target focus is honoured before the rest of the body part.
	const targetSession: ProgramSessionTemplate = {
		...session,
		focus: [{ bodyPart: 'upper legs', target: 'glutes', slots: 2 }]
	};
	const targeted = buildSessionExercises({ session: targetSession, prescription: base, catalog });
	assert(targeted[0].exerciseId === 'l2', 'target first');
	assert(targeted.length === 2, 'slot count respected');

	// Progress: 4 weeks × 3 sessions.
	const run: ProgramRun = { slug: program.slug, startedAt: '2026-01-01T00:00:00.000Z', slots: {} };
	const empty = programProgressView(program, run);
	assert(empty.total === 12 && empty.done === 0 && empty.percent === 0, 'progress empty');
	assert(empty.next?.week === 1 && empty.next?.sessionId === 'a', 'next is first slot');

	const startedRun: ProgramRun = {
		...run,
		slots: { '1:a': { planId: 'plan-a', startedAt: '2026-01-02T00:00:00.000Z', completedAt: null } }
	};
	assert(isSlotStarted(startedRun, 1, 'a') && !isSlotDone(startedRun, 1, 'a'), 'started ≠ done');
	assert(programProgressView(program, startedRun).done === 0, 'started does not count');

	const finished = reconcileWithFinishedPlans(startedRun, new Set(['plan-a']));
	assert(finished.changed, 'reconcile found work');
	assert(isSlotDone(finished.run, 1, 'a'), 'reconcile marks slot');
	assert(programProgressView(program, finished.run).done === 1, 'progress counts');
	assert(!reconcileWithFinishedPlans(startedRun, new Set(['other'])).changed, 'reconcile ignores strangers');
	assert(!reconcileWithFinishedPlans(finished.run, new Set(['plan-a'])).changed, 'reconcile is idempotent');

	const parsed = parseProgramRuns([
		{ slug: 'full-body-3x', startedAt: '2026-01-01T00:00:00.000Z', slots: { '1:a': { planId: 'y', startedAt: 's', completedAt: 'c' }, '1:b': { planId: '' } } },
		{ slug: 'unknown', startedAt: 'x' },
		'junk'
	]);
	assert(Object.keys(parsed).length === 1, 'parse drops unknown slugs');
	assert(Object.keys(parsed['full-body-3x'].slots).length === 1, 'parse drops broken slots');
	assert(Object.keys(parseProgramRuns(null)).length === 0, 'parse guards null');
}
