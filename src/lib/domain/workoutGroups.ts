import type { WorkoutExercise, WorkoutPlan } from './types';
import { newId } from './id';
import { REST_SEC, SETS } from './inputLimits';
import { DEFAULT_REST_SEC } from './workoutDefaults';
import { withUpdated, normalizePlanExercises, applyRoundRest } from './workoutMutate';

export function groupBounds(
	exercises: { groupId?: string | null }[],
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

export function altGroupBounds(
	exercises: { altGroupId?: string | null }[],
	index: number
): { start: number; end: number; altGroupId: string } | null {
	const item = exercises[index];
	if (!item?.altGroupId) return null;
	const altGroupId = item.altGroupId;
	let start = index;
	let end = index;
	while (start > 0 && exercises[start - 1]?.altGroupId === altGroupId) start -= 1;
	while (end < exercises.length - 1 && exercises[end + 1]?.altGroupId === altGroupId) end += 1;
	return { start, end, altGroupId };
}

/** When grouping, include all mates of any selected “or” block. */
function expandSelectionWithAltGroups(plan: WorkoutPlan, exerciseIds: readonly string[]): Set<string> {
	const set = new Set(exerciseIds);
	let grew = true;
	while (grew) {
		grew = false;
		for (const ex of plan.exercises) {
			if (!set.has(ex.exerciseId) || !ex.altGroupId) continue;
			for (const mate of plan.exercises) {
				if (mate.altGroupId === ex.altGroupId && !set.has(mate.exerciseId)) {
					set.add(mate.exerciseId);
					grew = true;
				}
			}
		}
	}
	return set;
}

function sharedGroupIdInSelection(selected: WorkoutExercise[]): string | null {
	const ids = [...new Set(selected.map((ex) => ex.groupId).filter((g): g is string => Boolean(g)))];
	return ids.length === 1 ? ids[0]! : null;
}

/** Contiguous block for reorder: superset or “or” group (2+ members). */
export function blockBounds(
	exercises: { groupId?: string | null; altGroupId?: string | null }[],
	index: number
): { start: number; end: number } | null {
	const gb = groupBounds(exercises, index);
	if (gb && gb.start !== gb.end) return { start: gb.start, end: gb.end };
	const ab = altGroupBounds(exercises, index);
	if (ab && ab.start !== ab.end) return { start: ab.start, end: ab.end };
	return null;
}

export type GroupMemberRole = 'solo' | 'first' | 'middle' | 'last';

export function groupMemberRole(
	exercises: { groupId?: string | null }[],
	index: number
): GroupMemberRole {
	const bounds = groupBounds(exercises, index);
	if (!bounds || bounds.start === bounds.end) return 'solo';
	if (index === bounds.start) return 'first';
	if (index === bounds.end) return 'last';
	return 'middle';
}

export function altGroupMemberRole(
	exercises: { altGroupId?: string | null }[],
	index: number
): GroupMemberRole {
	const bounds = altGroupBounds(exercises, index);
	if (!bounds || bounds.start === bounds.end) return 'solo';
	if (index === bounds.start) return 'first';
	if (index === bounds.end) return 'last';
	return 'middle';
}

/** Snap drag destination so items do not land inside group/or interiors. */
function clampDragMoveIndex(
	exercises: { groupId?: string | null; altGroupId?: string | null }[],
	fromIndex: number,
	toIndex: number
): number {
	const n = exercises.length;
	if (fromIndex < 0 || fromIndex >= n || toIndex < 0 || toIndex >= n) return toIndex;
	if (fromIndex === toIndex) return toIndex;

	const fromBlock = blockBounds(exercises, fromIndex);
	if (fromBlock && toIndex >= fromBlock.start && toIndex <= fromBlock.end) {
		return fromIndex;
	}

	const destBlock = blockBounds(exercises, toIndex);
	if (!destBlock) return toIndex;
	if (toIndex === destBlock.start) return toIndex;

	if (toIndex > destBlock.start && toIndex <= destBlock.end) {
		return fromIndex < toIndex ? destBlock.end : destBlock.start;
	}

	return toIndex;
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
		toIndex >= exercises.length
	) {
		return plan;
	}

	toIndex = clampDragMoveIndex(exercises, fromIndex, toIndex);
	if (fromIndex === toIndex) return plan;

	const bounds = blockBounds(exercises, fromIndex);
	if (!bounds) {
		const [item] = exercises.splice(fromIndex, 1);
		exercises.splice(toIndex, 0, item!);
		return withUpdated(plan, normalizePlanExercises(exercises));
	}

	const block = exercises.splice(bounds.start, bounds.end - bounds.start + 1);
	const insertAt = Math.min(
		Math.max(0, toIndex > fromIndex ? toIndex - (block.length - 1) : toIndex),
		exercises.length
	);
	exercises.splice(insertAt, 0, ...block);
	return withUpdated(plan, exercises);
}

/**
 * ↑/↓ semantics:
 * - inside a superset / or-group → reorder within the group
 * - first↑ / last↓ of a group → move the whole block
 * - solo next to a group → jump over the block (do not land in the middle)
 */
export function moveByArrow(
	plan: WorkoutPlan,
	fromIndex: number,
	direction: -1 | 1
): WorkoutPlan {
	const n = plan.exercises.length;
	const toIndex = fromIndex + direction;
	if (fromIndex < 0 || fromIndex >= n || toIndex < 0 || toIndex >= n) return plan;

	const bounds = blockBounds(plan.exercises, fromIndex);
	if (bounds) {
		if (direction < 0 && fromIndex > bounds.start) {
			return moveWithinBlock(plan, fromIndex, fromIndex - 1);
		}
		if (direction > 0 && fromIndex < bounds.end) {
			return moveWithinBlock(plan, fromIndex, fromIndex + 1);
		}
		const dest = direction < 0 ? bounds.start - 1 : bounds.end + 1;
		if (dest < 0 || dest >= n) return plan;
		return moveExercise(plan, fromIndex, dest);
	}

	const neighborBounds = blockBounds(plan.exercises, toIndex);
	if (neighborBounds) {
		const dest = direction < 0 ? neighborBounds.start : neighborBounds.end;
		return moveExercise(plan, fromIndex, dest);
	}
	return moveExercise(plan, fromIndex, toIndex);
}

/** Reorder within a contiguous block (superset reapplies round rest; or-group keeps rest). */
export function moveWithinGroup(plan: WorkoutPlan, fromIndex: number, toIndex: number): WorkoutPlan {
	return moveWithinBlock(plan, fromIndex, toIndex);
}

function moveWithinBlock(plan: WorkoutPlan, fromIndex: number, toIndex: number): WorkoutPlan {
	const bounds = blockBounds(plan.exercises, fromIndex);
	if (!bounds || toIndex < bounds.start || toIndex > bounds.end) return plan;
	const exercises = [...plan.exercises];
	const [item] = exercises.splice(fromIndex, 1);
	exercises.splice(toIndex, 0, item!);
	const nextBounds = blockBounds(exercises, toIndex);
	if (!nextBounds) return withUpdated(plan, exercises);
	const slice = exercises.slice(nextBounds.start, nextBounds.end + 1);
	const members = slice[0]?.groupId ? applyRoundRest(slice) : slice;
	exercises.splice(nextBounds.start, members.length, ...members);
	return withUpdated(plan, exercises);
}

export function formSuperset(plan: WorkoutPlan, exerciseIds: string[]): WorkoutPlan {
	const selectedSet = expandSelectionWithAltGroups(plan, exerciseIds);
	if (selectedSet.size < 2) return plan;

	const selected = plan.exercises.filter((ex) => selectedSet.has(ex.exerciseId));
	if (selected.length < 2) return plan;

	const rest = plan.exercises.filter((ex) => !selectedSet.has(ex.exerciseId));
	const insertAt = Math.min(
		...selected.map((ex) => plan.exercises.findIndex((e) => e.exerciseId === ex.exerciseId))
	);

	const groupId = sharedGroupIdInSelection(selected) ?? newId();
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
	return withUpdated(plan, normalizePlanExercises(exercises));
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

/** Interchangeable alternatives (“or”) — each keeps own sets/rest; live picks one. */
export function formOrGroup(plan: WorkoutPlan, exerciseIds: string[]): WorkoutPlan {
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

	const altGroupId = newId();
	const groupId = sharedGroupIdInSelection(selected);
	const grouped = selected.map((ex) => ({
		...ex,
		groupId,
		altGroupId,
		restSec: ex.restSec > 0 ? ex.restSec : DEFAULT_REST_SEC
	}));

	const exercises = [...rest];
	exercises.splice(Math.min(insertAt, exercises.length), 0, ...grouped);
	return withUpdated(plan, normalizePlanExercises(exercises));
}

export function dissolveOrGroup(plan: WorkoutPlan, altGroupId: string): WorkoutPlan {
	return withUpdated(
		plan,
		plan.exercises.map((ex) =>
			ex.altGroupId === altGroupId ? { ...ex, altGroupId: null } : ex
		)
	);
}

/** Turn an “or” block into sequential superset members (do all variants, not pick-one). */
export function convertAltGroupToSuperset(plan: WorkoutPlan, altGroupId: string): WorkoutPlan {
	const ids = plan.exercises
		.filter((ex) => ex.altGroupId === altGroupId)
		.map((ex) => ex.exerciseId);
	if (ids.length < 2) return plan;
	const grouped = formSuperset(plan, ids);
	return withUpdated(
		grouped,
		grouped.exercises.map((ex) =>
			ex.altGroupId === altGroupId ? { ...ex, altGroupId: null } : ex
		)
	);
}

export function updateGroupSets(plan: WorkoutPlan, groupId: string, sets: number): WorkoutPlan {
	const next = Math.min(SETS.max, Math.max(SETS.min, sets));
	return withUpdated(
		plan,
		plan.exercises.map((ex) => {
			if (ex.groupId !== groupId) return ex;
			const { repsScheme: _drop, ...rest } = ex;
			return { ...rest, sets: next };
		})
	);
}

export function updateGroupRest(plan: WorkoutPlan, groupId: string, restSec: number): WorkoutPlan {
	const next = Math.min(REST_SEC.max, Math.max(0, restSec));
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
