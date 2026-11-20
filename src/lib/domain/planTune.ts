/**
 * Smart plan tune («подстроить под сегодня»): AI rewrites the plan for one
 * session, the saved plan stays as it was. Pure diff/apply — no fetch, no AI.
 */
import type { WorkoutExercise, WorkoutPlan } from './types';

export type PlanTuneRow = {
	exerciseId: string;
	sets: number;
	reps: number;
	restSec: number;
};

export type PlanTuneField = 'sets' | 'reps' | 'restSec';

export type PlanTuneChange = {
	before: PlanTuneRow;
	after: PlanTuneRow;
	fields: PlanTuneField[];
};

export type PlanTuneDiff = {
	added: PlanTuneRow[];
	removed: PlanTuneRow[];
	changed: PlanTuneChange[];
	/** Same ids, new order. */
	reordered: boolean;
	/** Nothing changed at all (AI returned the plan as is). */
	empty: boolean;
};

export type PlanTune = {
	/** Optional new name; the today-variant keeps the plan name when empty. */
	name?: string | null;
	/** One short athlete-facing sentence from the model. */
	summary?: string | null;
	exercises: readonly PlanTuneRow[];
};

const FIELD_LIMITS: Record<PlanTuneField, { min: number; max: number }> = {
	sets: { min: 1, max: 99 },
	reps: { min: 1, max: 999 },
	restSec: { min: 0, max: 999 }
};

function clampField(field: PlanTuneField, value: unknown, fallback: number): number {
	const n = typeof value === 'number' ? value : Number(value);
	const limit = FIELD_LIMITS[field];
	if (!Number.isFinite(n)) return fallback;
	return Math.min(limit.max, Math.max(limit.min, Math.round(n)));
}

/** Plan/session exercises → the flat row shape the model sees and we diff. */
export function planTuneRows(
	exercises: readonly WorkoutExercise[] | readonly PlanTuneRow[]
): PlanTuneRow[] {
	return exercises.map((ex) => ({
		exerciseId: ex.exerciseId,
		sets: ex.sets,
		reps: ex.reps,
		restSec: ex.restSec
	}));
}

/** Normalise whatever the API returned into safe rows (drops dupes, keeps order). */
export function normalizePlanTuneRows(raw: unknown): PlanTuneRow[] {
	if (!Array.isArray(raw)) return [];
	const seen = new Set<string>();
	const rows: PlanTuneRow[] = [];
	for (const item of raw) {
		if (!item || typeof item !== 'object') continue;
		const rec = item as Record<string, unknown>;
		const exerciseId = String(rec.exerciseId ?? '').trim();
		if (!exerciseId || seen.has(exerciseId)) continue;
		seen.add(exerciseId);
		rows.push({
			exerciseId,
			sets: clampField('sets', rec.sets, 3),
			reps: clampField('reps', rec.reps, 10),
			restSec: clampField('restSec', rec.restSec, 90)
		});
	}
	return rows;
}

function fieldsChanged(before: PlanTuneRow, after: PlanTuneRow): PlanTuneField[] {
	const fields: PlanTuneField[] = [];
	if (before.sets !== after.sets) fields.push('sets');
	if (before.reps !== after.reps) fields.push('reps');
	if (before.restSec !== after.restSec) fields.push('restSec');
	return fields;
}

/**
 * What actually changed. Ids drive added/removed; surviving ids drive the
 * prescription diff and the order check.
 */
export function diffPlanTune(
	before: readonly PlanTuneRow[],
	after: readonly PlanTuneRow[]
): PlanTuneDiff {
	const beforeById = new Map(before.map((row) => [row.exerciseId, row]));
	const afterById = new Map(after.map((row) => [row.exerciseId, row]));

	const added = after.filter((row) => !beforeById.has(row.exerciseId));
	const removed = before.filter((row) => !afterById.has(row.exerciseId));
	const changed: PlanTuneChange[] = [];
	for (const row of after) {
		const prev = beforeById.get(row.exerciseId);
		if (!prev) continue;
		const fields = fieldsChanged(prev, row);
		if (fields.length > 0) changed.push({ before: prev, after: row, fields });
	}

	const keptBefore = before
		.map((row) => row.exerciseId)
		.filter((id) => afterById.has(id));
	const keptAfter = after.map((row) => row.exerciseId).filter((id) => beforeById.has(id));
	const reordered =
		keptBefore.length === keptAfter.length &&
		keptBefore.some((id, index) => id !== keptAfter[index]);

	return {
		added,
		removed,
		changed,
		reordered,
		empty: added.length === 0 && removed.length === 0 && changed.length === 0 && !reordered
	};
}

/** Group ids only survive when every member of that group survived the tune. */
function survivingGroupIds(
	before: readonly WorkoutExercise[],
	tunedIds: ReadonlySet<string>
): Set<string> {
	const totals = new Map<string, { total: number; kept: number }>();
	for (const ex of before) {
		for (const groupId of [ex.groupId, ex.altGroupId]) {
			if (!groupId) continue;
			const entry = totals.get(groupId) ?? { total: 0, kept: 0 };
			entry.total += 1;
			if (tunedIds.has(ex.exerciseId)) entry.kept += 1;
			totals.set(groupId, entry);
		}
	}
	const surviving = new Set<string>();
	for (const [groupId, entry] of totals) {
		if (entry.kept === entry.total) surviving.add(groupId);
	}
	return surviving;
}

/**
 * The «today» variant: same plan id (so live/resume keeps finding it), tuned
 * exercises. Groups stay only when they stay whole; a per-set reps ladder is
 * dropped when the set count changed (it would lie about the planned reps).
 */
export function applyPlanTune(
	plan: WorkoutPlan,
	tune: PlanTune,
	now: string = new Date().toISOString()
): WorkoutPlan {
	const rows = normalizePlanTuneRows(tune.exercises);
	const byId = new Map(rows.map((row) => [row.exerciseId, row]));
	const keptIds = new Set(byId.keys());
	const survivingGroups = survivingGroupIds(plan.exercises, keptIds);

	// Order follows the tuned list; kept prescriptions/groups come from the plan.
	const exercises: WorkoutExercise[] = [];
	for (const row of rows) {
		const prev = plan.exercises.find((ex) => ex.exerciseId === row.exerciseId);
		const groupId = prev?.groupId && survivingGroups.has(prev.groupId) ? prev.groupId : null;
		const altGroupId =
			prev?.altGroupId && survivingGroups.has(prev.altGroupId) ? prev.altGroupId : null;
		const keepScheme = prev?.repsScheme && prev.repsScheme.length === row.sets;
		exercises.push({
			exerciseId: row.exerciseId,
			sets: row.sets,
			reps: row.reps,
			restSec: row.restSec,
			...(keepScheme ? { repsScheme: prev.repsScheme } : {}),
			...(groupId ? { groupId } : {}),
			...(altGroupId ? { altGroupId } : {})
		});
	}

	const name = (tune.name ?? '').trim() || plan.name;
	return { ...plan, name, exercises, updatedAt: now };
}

export function runPlanTuneSelfCheck(): void {
	const before: PlanTuneRow[] = [
		{ exerciseId: 'a', sets: 4, reps: 6, restSec: 150 },
		{ exerciseId: 'b', sets: 3, reps: 10, restSec: 90 },
		{ exerciseId: 'c', sets: 3, reps: 12, restSec: 60 }
	];
	const after: PlanTuneRow[] = [
		// c moved above b on purpose: surviving ids swapped order.
		{ exerciseId: 'c', sets: 4, reps: 12, restSec: 75 },
		{ exerciseId: 'b', sets: 3, reps: 10, restSec: 90 },
		{ exerciseId: 'd', sets: 3, reps: 15, restSec: 45 }
	];
	const diff = diffPlanTune(before, after);
	if (diff.added.length !== 1 || diff.added[0]?.exerciseId !== 'd') {
		throw new Error('planTune: added');
	}
	if (diff.removed.length !== 1 || diff.removed[0]?.exerciseId !== 'a') {
		throw new Error('planTune: removed');
	}
	if (diff.changed.length !== 1 || diff.changed[0]?.after.exerciseId !== 'c') {
		throw new Error('planTune: changed');
	}
	if (diff.changed[0]?.fields.join(',') !== 'sets,restSec') {
		throw new Error('planTune: changed fields');
	}
	if (!diff.reordered) throw new Error('planTune: reordered');
	if (diff.empty) throw new Error('planTune: empty');

	const same = diffPlanTune(before, before);
	if (!same.empty || same.reordered || same.changed.length > 0) {
		throw new Error('planTune: identical plan must diff empty');
	}

	const rows = normalizePlanTuneRows([
		{ exerciseId: ' a ', sets: 0, reps: 5000, restSec: -10 },
		{ exerciseId: 'a', sets: 3, reps: 10, restSec: 90 },
		{ exerciseId: 'b', sets: '4', reps: '8', restSec: '120' }
	]);
	if (rows.length !== 2) throw new Error('planTune: dedupe');
	if (rows[0]?.exerciseId !== 'a' || rows[0].sets !== 1 || rows[0].reps !== 999 || rows[0].restSec !== 0) {
		throw new Error('planTune: clamp');
	}
	if (rows[1]?.sets !== 4 || rows[1].reps !== 8 || rows[1].restSec !== 120) {
		throw new Error('planTune: numeric strings');
	}

	const plan: WorkoutPlan = {
		id: 'plan-1',
		name: 'Грудь + трицепс',
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z',
		exercises: [
			{ exerciseId: 'a', sets: 4, reps: 8, restSec: 150, repsScheme: [8, 8, 8, 8] },
			{ exerciseId: 'b', sets: 3, reps: 10, restSec: 90, groupId: 'g1' },
			{ exerciseId: 'c', sets: 3, reps: 10, restSec: 90, groupId: 'g1' }
		]
	};

	// Superset loses a member → the survivor must not keep a one-man group.
	const brokenGroup = applyPlanTune(
		plan,
		{
			exercises: [
				{ exerciseId: 'a', sets: 3, reps: 8, restSec: 150 },
				{ exerciseId: 'b', sets: 3, reps: 10, restSec: 90 }
			]
		},
		'2026-02-02T00:00:00.000Z'
	);
	if (brokenGroup.id !== 'plan-1' || brokenGroup.name !== 'Грудь + трицепс') {
		throw new Error('planTune: plan identity');
	}
	if (brokenGroup.updatedAt !== '2026-02-02T00:00:00.000Z') throw new Error('planTune: updatedAt');
	if (brokenGroup.exercises[0]?.repsScheme) throw new Error('planTune: stale reps scheme');
	if (brokenGroup.exercises[1]?.groupId) {
		throw new Error('planTune: survivor must drop a broken group');
	}
	if (Object.hasOwn(brokenGroup.exercises[1] ?? {}, 'groupId')) {
		throw new Error('planTune: group key must be absent, not undefined');
	}

	// Whole superset survives → group id stays, order follows the tuned list.
	const whole = applyPlanTune(plan, {
		exercises: [
			{ exerciseId: 'c', sets: 3, reps: 12, restSec: 60 },
			{ exerciseId: 'b', sets: 3, reps: 10, restSec: 90 },
			{ exerciseId: 'a', sets: 4, reps: 8, restSec: 150 }
		]
	});
	if (whole.exercises.map((ex) => ex.exerciseId).join(',') !== 'c,b,a') {
		throw new Error('planTune: tuned order');
	}
	if (!whole.exercises.slice(0, 2).every((ex) => ex.groupId === 'g1')) {
		throw new Error('planTune: intact superset must keep group');
	}
	if (!whole.exercises[2]?.repsScheme) throw new Error('planTune: untouched ladder must stay');
}
