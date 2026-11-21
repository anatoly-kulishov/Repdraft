/**
 * Wave periodization cycle («волновая периодизация»): one 8–12 week mesocycle
 * that modulates volume and intensity of the athlete's saved plans.
 *
 * The wave follows the classic chart: an intensity week, then a volume week,
 * then an unload. Volume peaks on week 2 while intensity sits under its own
 * peak, and week 3 drops both axes before the block restarts. A cycle is
 * local-only state (like the athlete profile) and never rewrites the saved
 * plans: each week is a derived «today» variant.
 */
import type { AthleteGoalId } from './athleteProfile';
import { isAthleteGoalId } from './athleteProfile';
import { localDayKey, parseDayKey } from './calendar';
import { newId } from './id';
import { REPS, REST_SEC, SETS, clampPlanName } from './inputLimits';
import type { WorkoutExercise, WorkoutPlan, WorkoutSession } from './types';

export const CYCLE_STORAGE_KEY = 'repdraft:cycle';

export const CYCLE_LENGTHS = [8, 10, 12] as const;
export type CycleLength = (typeof CYCLE_LENGTHS)[number];

/** Weeks per wave block: intensity week, volume week, unload week. */
export const CYCLE_WAVE_WEEKS = 3;

/** Rotation cap: one plan per training day at most. */
export const CYCLE_MAX_PLANS = 7;

export type CycleWeekKind = 'intensity' | 'volume' | 'unload';

export type Mesocycle = {
	id: string;
	name: string;
	createdAt: string;
	updatedAt: string;
	/** Local day key (YYYY-MM-DD) of the first training week's start. */
	startDate: string;
	weeks: CycleLength;
	goal: AthleteGoalId;
	/** Rotation order inside a week; every plan is one weekly session. */
	planIds: string[];
};

export type CycleWave = {
	kind: CycleWeekKind;
	/** Percent of the saved plan's sets/reps baseline. */
	volumePct: number;
	/** Percent of the saved plan's intensity baseline. */
	intensityPct: number;
};

/**
 * Schematic wave shape for the chart: volume peaks on the second week, then the
 * block unloads. Percent of the plan baseline; the real prescription shift
 * lives in `GOAL_DELTAS` below and stays monotonic with this order.
 */
const WAVE: Record<CycleWeekKind, { volumePct: number; intensityPct: number }> = {
	intensity: { volumePct: 80, intensityPct: 112 },
	volume: { volumePct: 118, intensityPct: 92 },
	unload: { volumePct: 66, intensityPct: 80 }
};

type GoalDeltas = {
	/** Sets added on volume weeks. */
	setsVolume: number;
	/** Sets added on the intensity week (usually negative). */
	setsIntensity: number;
	repsVolume: number;
	repsIntensity: number;
	/** Rest seconds on volume weeks. */
	restVolume: number;
	restIntensity: number;
};

/**
 * How strongly the wave bites, per goal. Volume weeks add work; the intensity
 * week trades sets/reps for heavier weight and longer rest; the unload week
 * drops at least one set and keeps the plan's reps and rest.
 */
const GOAL_DELTAS: Record<AthleteGoalId, GoalDeltas> = {
	strength: { setsVolume: 0, setsIntensity: -1, repsVolume: 0, repsIntensity: -3, restVolume: 0, restIntensity: 45 },
	muscle: { setsVolume: 1, setsIntensity: -1, repsVolume: 1, repsIntensity: -2, restVolume: 0, restIntensity: 15 },
	cut: { setsVolume: 1, setsIntensity: 0, repsVolume: 2, repsIntensity: -2, restVolume: -10, restIntensity: -15 },
	endurance: { setsVolume: 1, setsIntensity: 0, repsVolume: 3, repsIntensity: -3, restVolume: -15, restIntensity: -20 },
	habit: { setsVolume: 0, setsIntensity: 0, repsVolume: 1, repsIntensity: -1, restVolume: 0, restIntensity: 0 }
};

function clampInt(value: number, min: number, max: number): number {
	if (!Number.isFinite(value)) return min;
	return Math.min(max, Math.max(min, Math.round(value)));
}

/** Week number (1-based) → its place in the wave block. */
export function cycleWeekKind(week: number): CycleWeekKind {
	const index = Math.max(1, clampInt(week, 1, Number.MAX_SAFE_INTEGER)) - 1;
	const phase = index % CYCLE_WAVE_WEEKS;
	if (phase === 0) return 'intensity';
	return phase === 1 ? 'volume' : 'unload';
}

export function cycleWave(week: number): CycleWave {
	const kind = cycleWeekKind(week);
	const { volumePct, intensityPct } = WAVE[kind];
	return { kind, volumePct, intensityPct };
}

/**
 * The week's prescription for one saved plan: same plan id, groups and order,
 * sets/reps/rest shifted by the wave and the goal. A per-set rep ladder is
 * dropped when the set count changes (it would lie about the planned reps).
 */
export function cycleWeekVariant(
	plan: WorkoutPlan,
	week: number,
	cycle: Pick<Mesocycle, 'goal'>,
	opts?: { weekLabel?: string; now?: string }
): WorkoutPlan {
	const kind = cycleWeekKind(week);
	const d = GOAL_DELTAS[cycle.goal];
	/* The unload drops at least one set and leaves reps and rest as planned. */
	const delta =
		kind === 'intensity'
			? { sets: d.setsIntensity, reps: d.repsIntensity, rest: d.restIntensity }
			: kind === 'volume'
				? { sets: d.setsVolume, reps: d.repsVolume, rest: d.restVolume }
				: { sets: Math.min(d.setsIntensity, -1), reps: 0, rest: 0 };

	const exercises: WorkoutExercise[] = plan.exercises.map((ex) => {
		const sets = clampInt(ex.sets + delta.sets, SETS.min, SETS.max);
		const reps = clampInt(ex.reps + delta.reps, REPS.min, REPS.max);
		const restSec = clampInt(ex.restSec + delta.rest, REST_SEC.min, REST_SEC.max);
		const keepScheme = ex.repsScheme && ex.repsScheme.length === sets;
		return {
			exerciseId: ex.exerciseId,
			sets,
			reps,
			restSec,
			...(keepScheme ? { repsScheme: ex.repsScheme } : {}),
			...(ex.groupId ? { groupId: ex.groupId } : {}),
			...(ex.altGroupId ? { altGroupId: ex.altGroupId } : {})
		};
	});

	const label = (opts?.weekLabel ?? '').trim();
	const name = clampPlanName(label ? `${label} · ${plan.name}` : plan.name);
	return { ...plan, name, exercises, updatedAt: opts?.now ?? new Date().toISOString() };
}

function dayKeyToUtcMs(dayKey: string): number | null {
	const parsed = parseDayKey(dayKey);
	if (!parsed) return null;
	return Date.UTC(parsed.year, parsed.monthIndex, parsed.day);
}

const DAY_MS = 86_400_000;

/** Days since the cycle start (0 on the first day). Null when startDate is junk. */
export function cycleDaysIn(cycle: Pick<Mesocycle, 'startDate'>, now: Date = new Date()): number | null {
	const start = dayKeyToUtcMs(cycle.startDate);
	if (start == null) return null;
	const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
	return Math.floor((today - start) / DAY_MS);
}

/**
 * Where the athlete is now. Before the start date the cycle sits on week 1;
 * after the last week it stays on the final week and `done` flips to true.
 */
export function cycleProgressNow(
	cycle: Pick<Mesocycle, 'startDate' | 'weeks'>,
	now: Date = new Date()
): { week: number; done: boolean } {
	const days = cycleDaysIn(cycle, now);
	if (days == null || days < 0) return { week: 1, done: false };
	const rawWeek = Math.floor(days / 7) + 1;
	if (rawWeek > cycle.weeks) return { week: cycle.weeks, done: true };
	return { week: rawWeek, done: false };
}

/** Inclusive local day range of one cycle week (weeks are 7 days from start). */
export function cycleWeekRange(
	cycle: Pick<Mesocycle, 'startDate'>,
	week: number
): { from: string; to: string } | null {
	const start = dayKeyToUtcMs(cycle.startDate);
	if (start == null) return null;
	const offset = (Math.max(1, Math.round(week)) - 1) * 7;
	const from = new Date(start + offset * DAY_MS);
	const to = new Date(start + (offset + 6) * DAY_MS);
	return {
		from: from.toISOString().slice(0, 10),
		to: to.toISOString().slice(0, 10)
	};
}

/** Finished sessions of this cycle's plans that fall inside the given week. */
export function cycleWeekSessions(
	cycle: Pick<Mesocycle, 'startDate' | 'planIds'>,
	week: number,
	sessions: readonly WorkoutSession[]
): WorkoutSession[] {
	const range = cycleWeekRange(cycle, week);
	if (!range) return [];
	const planIds = new Set(cycle.planIds);
	return sessions.filter((session) => {
		if (!session.finishedAt) return false;
		if (!session.planId || !planIds.has(session.planId)) return false;
		const day = localDayKey(new Date(session.finishedAt));
		return day >= range.from && day <= range.to;
	});
}

export type CycleWeekPlan = {
	planId: string;
	planName: string;
	done: boolean;
};

export type CycleWeekSummary = CycleWave & {
	week: number;
	from: string;
	to: string;
	/** Sessions planned in the rotation (one per selected plan). */
	planned: number;
	done: number;
	isCurrent: boolean;
	isPast: boolean;
};

/**
 * Week-by-week table for the planner chart and the week list.
 * Order inside a week is the stored rotation; a session counts as done when a
 * finished session for that plan exists in the week's date range.
 */
export function cycleWeeksSummary(
	cycle: Mesocycle,
	sessions: readonly WorkoutSession[],
	now: Date = new Date()
): CycleWeekSummary[] {
	const current = cycleProgressNow(cycle, now);
	const weeks: CycleWeekSummary[] = [];
	for (let week = 1; week <= cycle.weeks; week += 1) {
		const range = cycleWeekRange(cycle, week);
		if (!range) continue;
		const doneSessions = cycleWeekSessions(cycle, week, sessions);
		const donePlans = new Set(doneSessions.map((session) => session.planId));
		weeks.push({
			...cycleWave(week),
			week,
			from: range.from,
			to: range.to,
			planned: cycle.planIds.length,
			done: cycle.planIds.filter((id) => donePlans.has(id)).length,
			isCurrent: week === current.week && (!current.done || week === cycle.weeks),
			isPast: week < current.week
		});
	}
	return weeks;
}

/** Per-plan status inside one week (used by the week list CTA). */
export function cycleWeekPlanRows(
	cycle: Mesocycle,
	week: number,
	plans: readonly WorkoutPlan[],
	sessions: readonly WorkoutSession[]
): CycleWeekPlan[] {
	const byId = new Map(plans.map((plan) => [plan.id, plan]));
	const donePlans = new Set(
		cycleWeekSessions(cycle, week, sessions).map((session) => session.planId)
	);
	const rows: CycleWeekPlan[] = [];
	for (const planId of cycle.planIds) {
		const plan = byId.get(planId);
		if (!plan) continue;
		rows.push({ planId, planName: plan.name, done: donePlans.has(planId) });
	}
	return rows;
}

export function defaultCycleStartDate(now: Date = new Date()): string {
	// Monday of the current week keeps 「неделя 1」 aligned with the diary weeks.
	const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const shift = (date.getDay() + 6) % 7;
	date.setDate(date.getDate() - shift);
	return localDayKey(date);
}

export function newCycle(input: {
	name: string;
	startDate?: string;
	weeks?: number;
	goal: AthleteGoalId;
	planIds: readonly string[];
	now?: string;
}): Mesocycle {
	// normalizeCycle returns null only for non-objects; this input is always an object.
	return normalizeCycle({
		id: newId(),
		name: input.name,
		createdAt: input.now ?? new Date().toISOString(),
		updatedAt: input.now ?? new Date().toISOString(),
		startDate: input.startDate ?? defaultCycleStartDate(),
		weeks: input.weeks ?? 10,
		goal: input.goal,
		planIds: [...input.planIds]
	}) as Mesocycle;
}

function normalizePlanIds(raw: unknown): string[] {
	if (!Array.isArray(raw)) return [];
	const out: string[] = [];
	const seen = new Set<string>();
	for (const item of raw) {
		const id = String(item ?? '').trim();
		if (!id || seen.has(id)) continue;
		seen.add(id);
		out.push(id);
		if (out.length >= CYCLE_MAX_PLANS) break;
	}
	return out;
}

function normalizeIsoDate(raw: unknown, fallback: string): string {
	const value = typeof raw === 'string' ? raw.trim() : '';
	return parseDayKey(value) ? value : fallback;
}

function normalizeIsoTimestamp(raw: unknown, fallback: string): string {
	const value = typeof raw === 'string' ? raw.trim() : '';
	if (!value) return fallback;
	const ms = Date.parse(value);
	return Number.isFinite(ms) ? new Date(ms).toISOString() : fallback;
}

export function normalizeCycle(raw: unknown, now: Date = new Date()): Mesocycle | null {
	if (!raw || typeof raw !== 'object') return null;
	const v = raw as Record<string, unknown>;
	const nowIso = now.toISOString();
	const startFallback = defaultCycleStartDate(now);
	const id = typeof v.id === 'string' && v.id.trim() ? v.id.trim() : newId();
	const createdAt = normalizeIsoTimestamp(v.createdAt, nowIso);
	const weeksRaw = Number(v.weeks);
	const weeks: CycleLength = (CYCLE_LENGTHS as readonly number[]).includes(weeksRaw)
		? (weeksRaw as CycleLength)
		: 10;
	const goal = typeof v.goal === 'string' && isAthleteGoalId(v.goal) ? v.goal : 'muscle';
	const fallbackName = 'Cycle';
	const name = clampPlanName(typeof v.name === 'string' ? v.name.trim() : '') || fallbackName;
	return {
		id,
		name,
		createdAt,
		updatedAt: normalizeIsoTimestamp(v.updatedAt, createdAt),
		startDate: normalizeIsoDate(v.startDate, startFallback),
		weeks,
		goal,
		planIds: normalizePlanIds(v.planIds)
	};
}

export function parseCycleStorage(raw: string | null | undefined): Mesocycle | null {
	if (raw == null || raw === '') return null;
	try {
		return normalizeCycle(JSON.parse(raw) as unknown);
	} catch {
		return null;
	}
}

export function serializeCycleStorage(cycle: Mesocycle): string {
	return JSON.stringify(normalizeCycle(cycle));
}

/** Throws if the wave/kinds/clamping contract regresses. */
export function runCycleSelfCheck(): void {
	const kinds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(cycleWeekKind).join(',');
	if (kinds !== 'intensity,volume,unload,intensity,volume,unload,intensity,volume,unload,intensity') {
		throw new Error(`cycle: wave kinds ${kinds}`);
	}
	if (cycleWave(1).volumePct !== 80 || cycleWave(1).intensityPct !== 112) {
		throw new Error('cycle: intensity week percents');
	}
	if (cycleWave(2).volumePct !== 118 || cycleWave(2).intensityPct !== 92) {
		throw new Error('cycle: volume week must own the volume peak');
	}
	if (cycleWave(3).volumePct !== 66 || cycleWave(3).intensityPct !== 80) {
		throw new Error('cycle: unload week must drop both axes');
	}

	const plan: WorkoutPlan = {
		id: 'plan-1',
		name: 'Грудь + трицепс',
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z',
		exercises: [
			{ exerciseId: 'a', sets: 4, reps: 8, restSec: 150, repsScheme: [8, 8, 8, 8] },
			{ exerciseId: 'b', sets: 3, reps: 10, restSec: 90, groupId: 'g1' },
			{ exerciseId: 'c', sets: 3, reps: 10, restSec: 90, groupId: 'g1' },
			{ exerciseId: 'a', sets: 2, reps: 12, restSec: 60, altGroupId: 'alt1' }
		]
	};

	const intensity = cycleWeekVariant(plan, 1, { goal: 'strength' }, {
		weekLabel: 'Нед. 1',
		now: '2026-02-01T00:00:00.000Z'
	});
	if (intensity.id !== 'plan-1') throw new Error('cycle: variant must keep plan id');
	if (intensity.name !== 'Нед. 1 · Грудь + трицепс') throw new Error(`cycle: name ${intensity.name}`);
	if (intensity.updatedAt !== '2026-02-01T00:00:00.000Z') throw new Error('cycle: updatedAt');
	if (intensity.exercises.length !== plan.exercises.length) {
		throw new Error('cycle: duplicate exercise slots must survive');
	}
	if (intensity.exercises[0]?.sets !== 3) throw new Error('cycle: strength intensity sets −1');
	if (intensity.exercises[0]?.reps !== 5) throw new Error('cycle: strength intensity reps −3');
	if (intensity.exercises[0]?.restSec !== 195) throw new Error('cycle: strength intensity rest +45');
	if (intensity.exercises[0]?.repsScheme) throw new Error('cycle: stale ladder after sets change');
	if (intensity.exercises[1]?.groupId !== 'g1' || intensity.exercises[2]?.groupId !== 'g1') {
		throw new Error('cycle: superset groups must survive');
	}
	if (intensity.exercises[3]?.altGroupId !== 'alt1') throw new Error('cycle: alt group must survive');

	const volume = cycleWeekVariant(plan, 2, { goal: 'muscle' });
	if (volume.exercises[0]?.sets !== 5 || volume.exercises[0]?.reps !== 9) {
		throw new Error('cycle: muscle volume sets/reps');
	}
	// Muscle volume week adds a set → the ladder must drop, not lie.
	if (volume.exercises[0]?.repsScheme) throw new Error('cycle: ladder must drop on set change');

	const habit = cycleWeekVariant(plan, 4, { goal: 'habit' });
	if (habit.exercises[1]?.sets !== 3 || habit.exercises[1]?.reps !== 9) {
		throw new Error('cycle: habit intensity reps −1 only');
	}

	const unload = cycleWeekVariant(plan, 3, { goal: 'strength' });
	if (unload.exercises[0]?.sets !== 3) throw new Error('cycle: unload drops at least one set');
	if (unload.exercises[0]?.reps !== 8) throw new Error('cycle: unload keeps plan reps');
	if (unload.exercises[0]?.restSec !== 150) throw new Error('cycle: unload keeps plan rest');

	const floor = cycleWeekVariant(
		{ ...plan, exercises: [{ exerciseId: 'z', sets: 1, reps: 1, restSec: 0 }] },
		1,
		{ goal: 'strength' }
	);
	if (floor.exercises[0]?.sets !== 1 || floor.exercises[0]?.reps !== 1) {
		throw new Error('cycle: clamps must respect input limits');
	}

	const start = new Date(2026, 0, 5); // Monday
	const base: Mesocycle = {
		id: 'cycle-1',
		name: 'Весна',
		createdAt: '2026-01-05T00:00:00.000Z',
		updatedAt: '2026-01-05T00:00:00.000Z',
		startDate: '2026-01-05',
		weeks: 8,
		goal: 'muscle',
		planIds: ['plan-1', 'plan-2']
	};
	if (cycleProgressNow(base, start).week !== 1) throw new Error('cycle: week 1 on start day');
	if (cycleProgressNow(base, new Date(2026, 0, 11)).week !== 1) {
		throw new Error('cycle: last day of week 1');
	}
	if (cycleProgressNow(base, new Date(2026, 0, 12)).week !== 2) {
		throw new Error('cycle: week 2 rollover');
	}
	const finished = cycleProgressNow(base, new Date(2026, 2, 2)); // 8 weeks + 1 day
	if (!finished.done || finished.week !== 8) throw new Error('cycle: done after last week');
	if (cycleProgressNow({ ...base, startDate: 'junk' }, start).week !== 1) {
		throw new Error('cycle: junk start date falls back to week 1');
	}

	const range = cycleWeekRange(base, 2);
	if (range?.from !== '2026-01-12' || range.to !== '2026-01-18') {
		throw new Error(`cycle: week range ${JSON.stringify(range)}`);
	}

	const sessions: WorkoutSession[] = [
		{
			id: 's1',
			planId: 'plan-1',
			planName: 'Грудь',
			startedAt: new Date(2026, 0, 12, 9).toISOString(),
			finishedAt: new Date(2026, 0, 12, 10).toISOString(),
			exercises: []
		},
		{
			id: 's2',
			planId: 'plan-1',
			planName: 'Грудь',
			startedAt: new Date(2026, 0, 13, 9).toISOString(),
			finishedAt: new Date(2026, 0, 13, 10).toISOString(),
			exercises: []
		},
		{
			id: 's3',
			planId: 'plan-9',
			planName: 'Чужой',
			startedAt: new Date(2026, 0, 14, 9).toISOString(),
			finishedAt: new Date(2026, 0, 14, 10).toISOString(),
			exercises: []
		},
		{
			id: 's4',
			planId: 'plan-2',
			planName: 'Ноги',
			startedAt: new Date(2026, 0, 20, 9).toISOString(),
			finishedAt: null,
			exercises: []
		}
	];
	const week2 = cycleWeekSessions(base, 2, sessions);
	if (week2.length !== 2) throw new Error(`cycle: week 2 sessions ${week2.length}`);
	if (week2.some((s) => s.planId !== 'plan-1')) throw new Error('cycle: foreign plan leaked');

	const summary = cycleWeeksSummary(base, sessions, new Date(2026, 0, 13));
	if (summary.length !== 8) throw new Error('cycle: summary length');
	if (summary[1]?.done !== 1 || summary[1]?.planned !== 2) throw new Error('cycle: summary done');
	if (summary[1]?.kind !== 'volume') throw new Error('cycle: summary kind');
	if (!summary[1]?.isCurrent) throw new Error('cycle: summary current week');
	if (!summary[0]?.isPast) throw new Error('cycle: summary past week');

	const rows = cycleWeekPlanRows(
		base,
		2,
		[{ ...plan }, { ...plan, id: 'plan-2', name: 'Ноги' }],
		sessions
	);
	if (rows.map((row) => row.done).join(',') !== 'true,false') {
		throw new Error('cycle: week plan rows');
	}

	const junk = normalizeCycle({
		id: ' ',
		name: '',
		startDate: '2026-13-40',
		weeks: 7,
		goal: 'nope',
		planIds: ['a', 'a', ' ', 42, 'b']
	});
	if (!junk) throw new Error('cycle: normalize returns object for junk');
	if (junk.weeks !== 10) throw new Error('cycle: weeks fallback');
	if (junk.goal !== 'muscle') throw new Error('cycle: goal fallback');
	if (!parseDayKey(junk.startDate)) throw new Error('cycle: startDate fallback');
	if (junk.planIds.join(',') !== 'a,42,b') throw new Error(`cycle: planIds ${junk.planIds}`);
	if (normalizeCycle(null) !== null) throw new Error('cycle: null normalize');

	const parsed = parseCycleStorage(serializeCycleStorage(base));
	if (parsed?.weeks !== 8 || parsed.planIds.join(',') !== 'plan-1,plan-2') {
		throw new Error('cycle: storage round-trip');
	}
	if (parseCycleStorage('{oops') !== null) throw new Error('cycle: junk storage');
	if (defaultCycleStartDate(new Date(2026, 0, 8)) !== '2026-01-05') {
		throw new Error('cycle: monday start');
	}
}
