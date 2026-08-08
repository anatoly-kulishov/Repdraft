import type { WorkoutExercise, WorkoutPlan } from './types';
import { newId } from './id';

export const DEFAULT_SETS = 3;
export const DEFAULT_REPS = 10;
export const DEFAULT_REST_SEC = 90;

function nowIso(): string {
	return new Date().toISOString();
}

function withUpdated(plan: WorkoutPlan, exercises: WorkoutExercise[]): WorkoutPlan {
	return { ...plan, updatedAt: nowIso(), exercises };
}

/** Drop groupId when fewer than 2 members remain; restore rest on orphans. */
function normalizeGroups(exercises: WorkoutExercise[]): WorkoutExercise[] {
	const counts = new Map<string, number>();
	for (const ex of exercises) {
		if (!ex.groupId) continue;
		counts.set(ex.groupId, (counts.get(ex.groupId) ?? 0) + 1);
	}
	return exercises.map((ex) => {
		if (!ex.groupId) return ex;
		if ((counts.get(ex.groupId) ?? 0) >= 2) return ex;
		return {
			...ex,
			groupId: null,
			restSec: ex.restSec > 0 ? ex.restSec : DEFAULT_REST_SEC
		};
	});
}

function applyRoundRest(members: WorkoutExercise[]): WorkoutExercise[] {
	return members.map((ex, i) => ({
		...ex,
		restSec: i === members.length - 1 ? (ex.restSec > 0 ? ex.restSec : DEFAULT_REST_SEC) : 0
	}));
}

export function createEmptyDraft(): WorkoutPlan {
	const ts = nowIso();
	return {
		id: newId(),
		name: 'Новая тренировка',
		createdAt: ts,
		updatedAt: ts,
		exercises: []
	};
}

export type AddExerciseResult = {
	plan: WorkoutPlan;
	added: boolean;
};

export function addExercise(plan: WorkoutPlan, exerciseId: string): AddExerciseResult {
	if (plan.exercises.some((ex) => ex.exerciseId === exerciseId)) {
		return { plan, added: false };
	}

	const entry: WorkoutExercise = {
		exerciseId,
		sets: DEFAULT_SETS,
		reps: DEFAULT_REPS,
		restSec: DEFAULT_REST_SEC
	};

	return {
		plan: withUpdated(plan, [...plan.exercises, entry]),
		added: true
	};
}

export function removeExercise(plan: WorkoutPlan, exerciseId: string): WorkoutPlan {
	const exercises = normalizeGroups(plan.exercises.filter((ex) => ex.exerciseId !== exerciseId));
	return withUpdated(plan, exercises);
}

export function updateExercise(
	plan: WorkoutPlan,
	exerciseId: string,
	patch: Partial<Omit<WorkoutExercise, 'exerciseId'>>
): WorkoutPlan {
	const { groupId: _g, ...safePatch } = patch;
	return withUpdated(
		plan,
		plan.exercises.map((ex) => (ex.exerciseId === exerciseId ? { ...ex, ...safePatch } : ex))
	);
}

export function groupBounds(
	exercises: WorkoutExercise[],
	index: number
): { start: number; end: number; groupId: string } | null {
	const item = exercises[index];
	if (!item?.groupId) return null;
	const groupId = item.groupId;
	let start = index;
	let end = index;
	while (start > 0 && exercises[start - 1]?.groupId === groupId) start -= 1;
	while (end < exercises.length - 1 && exercises[end + 1]?.groupId === groupId) end += 1;
	return { start, end, groupId };
}

/**
 * Move a single exercise, or the whole contiguous group when the item is grouped.
 * Destination is clamped so a group stays intact.
 */
export function moveExercise(plan: WorkoutPlan, fromIndex: number, toIndex: number): WorkoutPlan {
	const exercises = [...plan.exercises];
	if (
		fromIndex < 0 ||
		toIndex < 0 ||
		fromIndex >= exercises.length ||
		toIndex >= exercises.length ||
		fromIndex === toIndex
	) {
		return plan;
	}

	const bounds = groupBounds(exercises, fromIndex);
	if (!bounds) {
		const [item] = exercises.splice(fromIndex, 1);
		exercises.splice(toIndex, 0, item!);
		return withUpdated(plan, normalizeGroups(exercises));
	}

	const block = exercises.splice(bounds.start, bounds.end - bounds.start + 1);
	const insertAt = Math.min(
		Math.max(0, toIndex > fromIndex ? toIndex - (block.length - 1) : toIndex),
		exercises.length
	);
	exercises.splice(insertAt, 0, ...block);
	return withUpdated(plan, exercises);
}

/** Reorder within a group only (from/to must be in the same group). */
export function moveWithinGroup(plan: WorkoutPlan, fromIndex: number, toIndex: number): WorkoutPlan {
	const bounds = groupBounds(plan.exercises, fromIndex);
	if (!bounds || toIndex < bounds.start || toIndex > bounds.end) return plan;
	const exercises = [...plan.exercises];
	const [item] = exercises.splice(fromIndex, 1);
	exercises.splice(toIndex, 0, item!);
	const nextBounds = groupBounds(exercises, toIndex);
	if (!nextBounds) return withUpdated(plan, exercises);
	const members = applyRoundRest(exercises.slice(nextBounds.start, nextBounds.end + 1));
	exercises.splice(nextBounds.start, members.length, ...members);
	return withUpdated(plan, exercises);
}

export function formSuperset(plan: WorkoutPlan, exerciseIds: string[]): WorkoutPlan {
	const unique = [...new Set(exerciseIds)];
	if (unique.length < 2) return plan;

	const selected = unique
		.map((id) => plan.exercises.find((ex) => ex.exerciseId === id))
		.filter((ex): ex is WorkoutExercise => Boolean(ex));
	if (selected.length < 2) return plan;

	const selectedSet = new Set(selected.map((ex) => ex.exerciseId));
	const rest = plan.exercises.filter((ex) => !selectedSet.has(ex.exerciseId));
	const insertAt = Math.min(
		...selected.map((ex) => plan.exercises.findIndex((e) => e.exerciseId === ex.exerciseId))
	);

	const groupId = newId();
	const sharedSets = selected[0]!.sets;
	const lastRest =
		selected[selected.length - 1]!.restSec > 0
			? selected[selected.length - 1]!.restSec
			: DEFAULT_REST_SEC;

	const grouped = applyRoundRest(
		selected.map((ex, i) => ({
			...ex,
			groupId,
			sets: sharedSets,
			restSec: i === selected.length - 1 ? lastRest : 0
		}))
	);

	const exercises = [...rest];
	exercises.splice(Math.min(insertAt, exercises.length), 0, ...grouped);
	return withUpdated(plan, normalizeGroups(exercises));
}

export function dissolveSuperset(plan: WorkoutPlan, groupId: string): WorkoutPlan {
	return withUpdated(
		plan,
		plan.exercises.map((ex) =>
			ex.groupId === groupId
				? {
						...ex,
						groupId: null,
						restSec: ex.restSec > 0 ? ex.restSec : DEFAULT_REST_SEC
					}
				: ex
		)
	);
}

export function updateGroupSets(plan: WorkoutPlan, groupId: string, sets: number): WorkoutPlan {
	const next = Math.min(20, Math.max(1, sets));
	return withUpdated(
		plan,
		plan.exercises.map((ex) => (ex.groupId === groupId ? { ...ex, sets: next } : ex))
	);
}

export function updateGroupRest(plan: WorkoutPlan, groupId: string, restSec: number): WorkoutPlan {
	const next = Math.min(600, Math.max(0, restSec));
	const indices = plan.exercises
		.map((ex, i) => (ex.groupId === groupId ? i : -1))
		.filter((i) => i >= 0);
	if (indices.length === 0) return plan;
	const last = indices[indices.length - 1]!;
	return withUpdated(
		plan,
		plan.exercises.map((ex, i) => {
			if (ex.groupId !== groupId) return ex;
			return { ...ex, restSec: i === last ? next : 0 };
		})
	);
}

export function duplicatePlan(plan: WorkoutPlan): WorkoutPlan {
	const ts = nowIso();
	const groupMap = new Map<string, string>();
	return {
		...plan,
		id: newId(),
		name: `${plan.name} (копия)`,
		createdAt: ts,
		updatedAt: ts,
		exercises: plan.exercises.map((ex) => {
			if (!ex.groupId) return { ...ex };
			let mapped = groupMap.get(ex.groupId);
			if (!mapped) {
				mapped = newId();
				groupMap.set(ex.groupId, mapped);
			}
			return { ...ex, groupId: mapped };
		})
	};
}

export function withSavedName(plan: WorkoutPlan): WorkoutPlan {
	const name = plan.name.trim() || 'Тренировка без названия';
	return {
		...plan,
		name,
		updatedAt: nowIso()
	};
}
