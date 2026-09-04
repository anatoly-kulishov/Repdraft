import type { WorkoutExercise, WorkoutPlan } from './types';
import type { ExerciseIndexItem } from './types';
import { labelTarget } from './labels.ru';
import type { AppLocale } from '$lib/i18n/locale';
import { newId } from './id';
import { REPS, REST_SEC, SETS, clampPlanName } from './inputLimits';

export const DEFAULT_SETS = 3;
export const DEFAULT_REPS = 10;
export const DEFAULT_REST_SEC = 90;
/** Squat / bench / deadlift family — longer recovery between heavy sets. */
export const HEAVY_COMPOUND_REST_SEC = 180;

export type ExerciseRestHint = {
	name?: string;
	equipment?: string;
};

/** Catalog equipment value for calisthenics / own-body load. */
export function isBodyweightEquipment(equipment: string | null | undefined): boolean {
	return /^body weight$/i.test((equipment ?? '').trim());
}

/** Catalog zone: machines / conditioning where weight × reps is the wrong log shape. */
export function isCardioBodyPart(bodyPart: string | null | undefined): boolean {
	return /^cardio$/i.test((bodyPart ?? '').trim());
}

const HEAVY_REST_EQ =
	/^(barbell|smith machine|sled machine|olympic barbell|trap bar|hex bar)$/i;

const HEAVY_REST_LIGHT_VARIANT =
	/jump|прыж|split|bulgarian|болгар|one.?leg|single.?leg|pistol|пистолет|goblet|sissy|wall.?sit|curtsy|lunge|выпад/i;

/**
 * Default rest when adding to a plan. Heavy barbell/smith compounds → 180s; else 90s.
 * Uses catalog EN name + equipment (stable); does not rewrite saved plans.
 */
export function defaultRestSecForExercise(hint?: ExerciseRestHint): number {
	if (!hint?.name) return DEFAULT_REST_SEC;
	return isHeavyCompoundLift(hint.name, hint.equipment ?? '')
		? HEAVY_COMPOUND_REST_SEC
		: DEFAULT_REST_SEC;
}

function isHeavyCompoundLift(name: string, equipment: string): boolean {
	const n = name.trim();
	const eq = equipment.trim();
	if (!n) return false;
	if (HEAVY_REST_LIGHT_VARIANT.test(n)) return false;
	if (/^(band|cable|dumbbell|kettlebell|body weight|assisted)$/i.test(eq)) return false;

	const barbellish =
		HEAVY_REST_EQ.test(eq) || /\b(barbell|smith|trap bar|hex bar)\b/i.test(n) || /\bhack squat\b/i.test(n);
	if (!barbellish) return false;

	if (/\bsquat\b/i.test(n)) return true;
	if (/\bbench press\b/i.test(n)) return true;
	if (/\bdeadlift\b/i.test(n)) return true;
	return false;
}

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

/** Drop altGroupId when fewer than 2 members remain. */
function normalizeAltGroups(exercises: WorkoutExercise[]): WorkoutExercise[] {
	const counts = new Map<string, number>();
	for (const ex of exercises) {
		if (!ex.altGroupId) continue;
		counts.set(ex.altGroupId, (counts.get(ex.altGroupId) ?? 0) + 1);
	}
	return exercises.map((ex) => {
		if (!ex.altGroupId) return ex;
		if ((counts.get(ex.altGroupId) ?? 0) >= 2) return ex;
		return { ...ex, altGroupId: null };
	});
}

function normalizePlanExercises(exercises: WorkoutExercise[]): WorkoutExercise[] {
	return normalizeAltGroups(normalizeGroups(exercises));
}

function applyRoundRest(members: WorkoutExercise[]): WorkoutExercise[] {
	return members.map((ex, i) => ({
		...ex,
		restSec: i === members.length - 1 ? (ex.restSec > 0 ? ex.restSec : DEFAULT_REST_SEC) : 0
	}));
}

export function createEmptyDraft(defaultName = ''): WorkoutPlan {
	const ts = nowIso();
	return {
		id: newId(),
		name: defaultName,
		createdAt: ts,
		updatedAt: ts,
		exercises: []
	};
}

export type AddExerciseResult = {
	plan: WorkoutPlan;
	added: boolean;
};

export function addExercise(
	plan: WorkoutPlan,
	exerciseId: string,
	hint?: ExerciseRestHint
): AddExerciseResult {
	if (plan.exercises.some((ex) => ex.exerciseId === exerciseId)) {
		return { plan, added: false };
	}

	const entry: WorkoutExercise = {
		exerciseId,
		sets: DEFAULT_SETS,
		reps: DEFAULT_REPS,
		restSec: defaultRestSecForExercise(hint)
	};

	return {
		plan: withUpdated(plan, [...plan.exercises, entry]),
		added: true
	};
}

export function removeExercise(plan: WorkoutPlan, exerciseId: string): WorkoutPlan {
	const exercises = normalizePlanExercises(
		plan.exercises.filter((ex) => ex.exerciseId !== exerciseId)
	);
	return withUpdated(plan, exercises);
}

/** Undo remove: re-insert the full row (sets, groups) at its prior index. */
export function insertExerciseAt(
	plan: WorkoutPlan,
	exercise: WorkoutExercise,
	index: number
): WorkoutPlan {
	if (plan.exercises.some((ex) => ex.exerciseId === exercise.exerciseId)) return plan;
	const exercises = [...plan.exercises];
	const at = Math.min(Math.max(0, index), exercises.length);
	exercises.splice(at, 0, { ...exercise });
	return withUpdated(plan, normalizePlanExercises(exercises));
}

export function updateExercise(
	plan: WorkoutPlan,
	exerciseId: string,
	patch: Partial<Omit<WorkoutExercise, 'exerciseId'>>
): WorkoutPlan {
	const { groupId: _g, altGroupId: _a, ...safePatch } = patch;
	const clamped: typeof safePatch = { ...safePatch };
	if (clamped.sets != null) {
		clamped.sets = Math.min(SETS.max, Math.max(SETS.min, Math.round(clamped.sets)));
	}
	if (clamped.reps != null) {
		clamped.reps = Math.min(REPS.max, Math.max(REPS.min, Math.round(clamped.reps)));
	}
	if (clamped.restSec != null) {
		clamped.restSec = Math.min(REST_SEC.max, Math.max(REST_SEC.min, Math.round(clamped.restSec)));
	}
	return withUpdated(
		plan,
		plan.exercises.map((ex) => (ex.exerciseId === exerciseId ? { ...ex, ...clamped } : ex))
	);
}

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
	const next = Math.min(20, Math.max(1, sets));
	return withUpdated(
		plan,
		plan.exercises.map((ex) => (ex.groupId === groupId ? { ...ex, sets: next } : ex))
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

export function duplicatePlan(plan: WorkoutPlan, copySuffix = '(copy)'): WorkoutPlan {
	const ts = nowIso();
	const groupMap = new Map<string, string>();
	const altMap = new Map<string, string>();
	return {
		...plan,
		id: newId(),
		name: clampPlanName(`${plan.name} ${copySuffix}`.trim()),
		createdAt: ts,
		updatedAt: ts,
		exercises: plan.exercises.map((ex) => {
			let groupId = ex.groupId ?? null;
			let altGroupId = ex.altGroupId ?? null;
			if (groupId) {
				let mapped = groupMap.get(groupId);
				if (!mapped) {
					mapped = newId();
					groupMap.set(groupId, mapped);
				}
				groupId = mapped;
			}
			if (altGroupId) {
				let mapped = altMap.get(altGroupId);
				if (!mapped) {
					mapped = newId();
					altMap.set(altGroupId, mapped);
				}
				altGroupId = mapped;
			}
			return { ...ex, groupId, altGroupId };
		})
	};
}

export function withSavedName(plan: WorkoutPlan, untitledFallback = 'Untitled workout'): WorkoutPlan {
	const cleaned = clampPlanName(plan.name.replace(/\s+/g, ' ').trim());
	const name = cleaned || untitledFallback;
	return {
		...plan,
		name,
		updatedAt: nowIso()
	};
}

/** Prescription + title only — ignores createdAt/updatedAt. */
export function workoutPlanContentEqual(a: WorkoutPlan, b: WorkoutPlan): boolean {
	const nameA = clampPlanName(a.name.replace(/\s+/g, ' ').trim());
	const nameB = clampPlanName(b.name.replace(/\s+/g, ' ').trim());
	if (nameA !== nameB) return false;
	if (a.exercises.length !== b.exercises.length) return false;
	return a.exercises.every((ex, index) => {
		const other = b.exercises[index];
		if (!other) return false;
		return (
			ex.exerciseId === other.exerciseId &&
			ex.sets === other.sets &&
			ex.reps === other.reps &&
			ex.restSec === other.restSec &&
			(ex.groupId ?? null) === (other.groupId ?? null) &&
			(ex.altGroupId ?? null) === (other.altGroupId ?? null)
		);
	});
}

/** Unique target muscle labels for plan cards (order preserved, capped). */
export function planTargetSummary(
	plan: WorkoutPlan,
	indexById: Map<string, ExerciseIndexItem>,
	locale: AppLocale = 'ru',
	maxLabels = 4
): string {
	const seen = new Set<string>();
	const parts: string[] = [];
	for (const ex of plan.exercises) {
		const meta = indexById.get(ex.exerciseId);
		if (!meta?.target) continue;
		const label = labelTarget(meta.target, locale);
		if (seen.has(label)) continue;
		seen.add(label);
		parts.push(label);
		if (parts.length >= maxLabels) break;
	}
	return parts.join(' · ');
}

export function planPrescribedSetCount(plan: WorkoutPlan): number {
	let total = 0;
	let i = 0;
	const list = plan.exercises;
	while (i < list.length) {
		const ab = altGroupBounds(list, i);
		if (ab && ab.start === i && ab.end > ab.start) {
			total += Math.max(0, list[i]!.sets);
			i = ab.end + 1;
			continue;
		}
		total += Math.max(0, list[i]!.sets);
		i += 1;
	}
	return total;
}

/** Plan list cards: each “or” block counts as one slot (not N alternatives). */
export function planExerciseSlotCount(plan: WorkoutPlan): number {
	let count = 0;
	let i = 0;
	const list = plan.exercises;
	while (i < list.length) {
		const ab = altGroupBounds(list, i);
		if (ab && ab.start === i && ab.end > ab.start) {
			count += 1;
			i = ab.end + 1;
			continue;
		}
		count += 1;
		i += 1;
	}
	return count;
}

/** Union local + cloud without dropping device-only rows (empty cloud must not wipe UI). */
export function mergeWorkoutPlans(local: WorkoutPlan[], cloud: WorkoutPlan[]): WorkoutPlan[] {
	const map = new Map<string, WorkoutPlan>();
	for (const plan of local) map.set(plan.id, plan);
	for (const plan of cloud) {
		const prev = map.get(plan.id);
		if (!prev || plan.updatedAt.localeCompare(prev.updatedAt) >= 0) {
			map.set(plan.id, plan);
		}
	}
	return [...map.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * Home CTA: next plan in list order after the last finished one (split rotation).
 * Falls back to the first plan when there is no history or the last plan was deleted.
 */
export function suggestNextPlan<T extends { id: string }>(
	plans: readonly T[],
	lastFinishedPlanId: string | null | undefined
): T | null {
	if (plans.length === 0) return null;
	if (!lastFinishedPlanId) return plans[0]!;
	const idx = plans.findIndex((p) => p.id === lastFinishedPlanId);
	if (idx < 0) return plans[0]!;
	return plans[(idx + 1) % plans.length]!;
}

/** Manual pin wins; otherwise split rotation from last finished session. */
export function resolveHomeNextPlan<T extends { id: string }>(
	plans: readonly T[],
	lastFinishedPlanId: string | null | undefined,
	pinnedPlanId: string | null | undefined
): T | null {
	if (plans.length === 0) return null;
	if (pinnedPlanId) {
		const pinned = plans.find((p) => p.id === pinnedPlanId);
		if (pinned) return pinned;
	}
	return suggestNextPlan(plans, lastFinishedPlanId);
}

/** After finishing `finishedPlanId`, advance pin unless user pinned a different plan. */
export function advanceHomeNextPlanId(
	plans: readonly { id: string }[],
	finishedPlanId: string,
	pinnedPlanId: string | null | undefined
): string | null {
	if (pinnedPlanId && pinnedPlanId !== finishedPlanId) return pinnedPlanId;
	return suggestNextPlan(plans, finishedPlanId)?.id ?? null;
}

/** User-defined plan list order (localStorage ids). Unknown ids append at end (e.g. cloud sync). */
export function syncPlanOrderIds(orderIds: readonly string[], planIds: readonly string[]): string[] {
	const set = new Set(planIds);
	const kept = orderIds.filter((id) => set.has(id));
	for (const id of planIds) {
		if (!kept.includes(id)) kept.push(id);
	}
	return kept;
}

export function sortPlansByUserOrder<T extends { id: string; updatedAt?: string }>(
	plans: readonly T[],
	orderIds: readonly string[] | null | undefined
): T[] {
	if (!orderIds || orderIds.length === 0) {
		return [...plans].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
	}
	const index = new Map(orderIds.map((id, i) => [id, i]));
	return [...plans].sort((a, b) => {
		const ai = index.get(a.id);
		const bi = index.get(b.id);
		if (ai != null && bi != null) return ai - bi;
		if (ai != null) return -1;
		if (bi != null) return 1;
		return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '');
	});
}

/** Display-only: surface the “next” plan first without changing stored order. */
export function promotePlanToFront<T extends { id: string }>(
	plans: readonly T[],
	planId: string | null | undefined
): T[] {
	if (!planId || plans.length < 2) return [...plans];
	const idx = plans.findIndex((p) => p.id === planId);
	if (idx <= 0) return [...plans];
	const promoted = plans[idx]!;
	return [promoted, ...plans.slice(0, idx), ...plans.slice(idx + 1)];
}

export function reorderPlanOrderIds(
	orderIds: readonly string[],
	planId: string,
	direction: -1 | 1
): string[] {
	const idx = orderIds.indexOf(planId);
	if (idx < 0) return [...orderIds];
	const target = idx + direction;
	if (target < 0 || target >= orderIds.length) return [...orderIds];
	const out = [...orderIds];
	[out[idx], out[target]] = [out[target]!, out[idx]!];
	return out;
}

/** Move one id from `fromIndex` to `toIndex` (splice semantics, like drag-and-drop). */
export function moveOrderIds(
	orderIds: readonly string[],
	fromIndex: number,
	toIndex: number
): string[] {
	if (fromIndex === toIndex) return [...orderIds];
	if (
		fromIndex < 0 ||
		toIndex < 0 ||
		fromIndex >= orderIds.length ||
		toIndex >= orderIds.length
	) {
		return [...orderIds];
	}
	const out = [...orderIds];
	const [item] = out.splice(fromIndex, 1);
	out.splice(toIndex, 0, item!);
	return out;
}

/** Throws if draft / superset / arrow-move invariants regress. */
export function runWorkoutSelfCheck(): void {
	if (defaultRestSecForExercise() !== DEFAULT_REST_SEC) {
		throw new Error('missing hint should default to 90s');
	}
	if (
		defaultRestSecForExercise({ name: 'barbell full squat', equipment: 'barbell' }) !==
		HEAVY_COMPOUND_REST_SEC
	) {
		throw new Error('barbell squat should default to 180s');
	}
	if (
		defaultRestSecForExercise({ name: 'barbell bench press', equipment: 'barbell' }) !==
		HEAVY_COMPOUND_REST_SEC
	) {
		throw new Error('barbell bench should default to 180s');
	}
	if (
		defaultRestSecForExercise({ name: 'barbell deadlift', equipment: 'barbell' }) !==
		HEAVY_COMPOUND_REST_SEC
	) {
		throw new Error('barbell deadlift should default to 180s');
	}
	if (
		defaultRestSecForExercise({ name: 'barbell romanian deadlift', equipment: 'barbell' }) !==
		HEAVY_COMPOUND_REST_SEC
	) {
		throw new Error('barbell RDL should default to 180s');
	}
	if (
		defaultRestSecForExercise({ name: 'smith bench press', equipment: 'smith machine' }) !==
		HEAVY_COMPOUND_REST_SEC
	) {
		throw new Error('smith bench should default to 180s');
	}
	if (
		defaultRestSecForExercise({ name: 'diamond push-up', equipment: 'body weight' }) !==
		DEFAULT_REST_SEC
	) {
		throw new Error('diamond push-up should stay 90s');
	}
	if (!isBodyweightEquipment('body weight') || isBodyweightEquipment('barbell')) {
		throw new Error('isBodyweightEquipment should match catalog body weight');
	}
	if (!isCardioBodyPart('cardio') || isCardioBodyPart('chest')) {
		throw new Error('isCardioBodyPart should match catalog cardio zone');
	}
	if (
		defaultRestSecForExercise({ name: 'barbell jump squat', equipment: 'barbell' }) !==
		DEFAULT_REST_SEC
	) {
		throw new Error('jump squat should stay 90s');
	}
	if (
		defaultRestSecForExercise({ name: 'dumbbell goblet squat', equipment: 'dumbbell' }) !==
		DEFAULT_REST_SEC
	) {
		throw new Error('goblet squat should stay 90s');
	}
	if (
		defaultRestSecForExercise({ name: 'band stiff leg deadlift', equipment: 'band' }) !==
		DEFAULT_REST_SEC
	) {
		throw new Error('band deadlift should stay 90s');
	}

	let plan = createEmptyDraft('Check');
	const heavy = addExercise(createEmptyDraft('Heavy'), '1462', {
		name: 'barbell full squat (side pov)',
		equipment: 'barbell'
	});
	if (!heavy.added || heavy.plan.exercises[0]?.restSec !== HEAVY_COMPOUND_REST_SEC) {
		throw new Error('addExercise should apply heavy rest default');
	}

	const a = addExercise(plan, 'ex-a');
	if (!a.added) throw new Error('first add should succeed');
	plan = a.plan;
	if (plan.exercises[0]?.restSec !== DEFAULT_REST_SEC) {
		throw new Error('id-only add should keep 90s rest');
	}
	const again = addExercise(plan, 'ex-a');
	if (again.added) throw new Error('duplicate add should be rejected');
	plan = addExercise(plan, 'ex-b').plan;
	plan = addExercise(plan, 'ex-c').plan;

	plan = formSuperset(plan, ['ex-a', 'ex-b']);
	const g = plan.exercises[0]?.groupId;
	if (!g || plan.exercises[0]?.groupId !== plan.exercises[1]?.groupId) {
		throw new Error('formSuperset should share groupId');
	}
	if (plan.exercises[2]?.groupId) throw new Error('ex-c should stay solo');

	const before = plan.exercises.map((ex) => ex.exerciseId).join(',');
	plan = moveByArrow(plan, 0, 1);
	const after = plan.exercises.map((ex) => ex.exerciseId).join(',');
	if (before === 'ex-a,ex-b,ex-c' && after !== 'ex-b,ex-a,ex-c') {
		throw new Error(`moveByArrow within group expected ex-b,ex-a,ex-c got ${after}`);
	}

	plan = dissolveSuperset(plan, g);
	if (plan.exercises.some((ex) => ex.groupId === g)) {
		throw new Error('dissolveSuperset should clear groupId');
	}

	plan = formOrGroup(plan, ['ex-a', 'ex-b', 'ex-c']);
	const alt = plan.exercises[0]?.altGroupId;
	if (
		!alt ||
		plan.exercises[0]?.altGroupId !== plan.exercises[1]?.altGroupId ||
		plan.exercises[1]?.altGroupId !== plan.exercises[2]?.altGroupId
	) {
		throw new Error('formOrGroup should share altGroupId');
	}
	if (plan.exercises.some((ex) => ex.groupId)) {
		throw new Error('formOrGroup should clear groupId when selection spans groups');
	}
	if (planExerciseSlotCount(plan) !== 1) {
		throw new Error('or-group should count as one slot');
	}

	plan = dissolveOrGroup(plan, alt);
	if (plan.exercises.some((ex) => ex.altGroupId === alt)) {
		throw new Error('dissolveOrGroup should clear altGroupId');
	}
	if (planExerciseSlotCount(plan) !== 3) {
		throw new Error('dissolved or-group should count as three slots');
	}

	plan = formOrGroup(plan, ['ex-a', 'ex-b']);
	const altPair = plan.exercises[0]?.altGroupId;
	if (!altPair || plan.exercises[0]?.altGroupId !== plan.exercises[1]?.altGroupId) {
		throw new Error('formOrGroup pair should share altGroupId');
	}
	plan = addExercise(plan, 'ex-d').plan;
	plan = formSuperset(plan, ['ex-a', 'ex-d']);
	const comboG = plan.exercises[0]?.groupId;
	if (
		!comboG ||
		plan.exercises[0]?.groupId !== plan.exercises[1]?.groupId ||
		plan.exercises[1]?.groupId !== plan.exercises[2]?.groupId
	) {
		throw new Error('superset should share groupId across A, alt pair, and D');
	}
	if (plan.exercises[1]?.altGroupId !== plan.exercises[0]?.altGroupId) {
		throw new Error('alt pair should keep altGroupId inside superset');
	}
	if (plan.exercises[2]?.altGroupId) {
		throw new Error('solo superset member D should not have altGroupId');
	}
	if (planExerciseSlotCount(plan) !== 3) {
		throw new Error('combined superset+alt should count as three slots');
	}

	plan = convertAltGroupToSuperset(plan, altPair);
	if (plan.exercises.some((ex) => ex.altGroupId === altPair)) {
		throw new Error('convertAltGroupToSuperset should clear altGroupId');
	}
	if (plan.exercises[0]?.groupId !== plan.exercises[1]?.groupId) {
		throw new Error('convertAltGroupToSuperset should set groupId');
	}
	plan = dissolveSuperset(plan, plan.exercises[0]!.groupId!);
	if (plan.exercises.length !== 4) {
		throw new Error(`expected 4 exercises after superset flow, got ${plan.exercises.length}`);
	}

	{
		let undoPlan = createEmptyDraft();
		for (const id of ['ex-a', 'ex-b', 'ex-c']) undoPlan = addExercise(undoPlan, id).plan;
		undoPlan = removeExercise(undoPlan, 'ex-b');
		undoPlan = insertExerciseAt(undoPlan, { exerciseId: 'ex-b', sets: 2, reps: 8, restSec: 60 }, 1);
		if (undoPlan.exercises.map((ex) => ex.exerciseId).join(',') !== 'ex-a,ex-b,ex-c') {
			throw new Error('insertExerciseAt should restore at index');
		}
		if (undoPlan.exercises.length !== 3) {
			throw new Error(`insertExerciseAt expected 3 exercises, got ${undoPlan.exercises.length}`);
		}
	}

	const rotation = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
	if (suggestNextPlan(rotation, null)?.id !== 'a') {
		throw new Error('suggestNextPlan without history should return first');
	}
	if (suggestNextPlan(rotation, 'a')?.id !== 'b') {
		throw new Error('suggestNextPlan should advance after last finished');
	}
	if (suggestNextPlan(rotation, 'c')?.id !== 'a') {
		throw new Error('suggestNextPlan should wrap to first');
	}
	if (suggestNextPlan(rotation, 'gone')?.id !== 'a') {
		throw new Error('suggestNextPlan with deleted last should return first');
	}
	if (suggestNextPlan([{ id: 'solo' }], 'solo')?.id !== 'solo') {
		throw new Error('suggestNextPlan with one plan should stay on it');
	}
	if (resolveHomeNextPlan(rotation, 'a', 'c')?.id !== 'c') {
		throw new Error('resolveHomeNextPlan should prefer pinned plan');
	}
	if (resolveHomeNextPlan(rotation, 'a', 'gone')?.id !== 'b') {
		throw new Error('resolveHomeNextPlan should fall back when pin missing');
	}
	if (advanceHomeNextPlanId(rotation, 'a', 'a') !== 'b') {
		throw new Error('advanceHomeNextPlanId should advance pinned finished plan');
	}
	if (advanceHomeNextPlanId(rotation, 'b', 'a') !== 'a') {
		throw new Error('advanceHomeNextPlanId should keep unrelated pin');
	}
	const ordered = sortPlansByUserOrder(
		[
			{ id: 'c', updatedAt: '2026-01-03' },
			{ id: 'a', updatedAt: '2026-01-01' },
			{ id: 'b', updatedAt: '2026-01-02' }
		],
		['a', 'b', 'c']
	);
	if (ordered.map((p) => p.id).join(',') !== 'a,b,c') {
		throw new Error('sortPlansByUserOrder should follow order ids');
	}
	if (promotePlanToFront(ordered, 'c').map((p) => p.id).join(',') !== 'c,a,b') {
		throw new Error('promotePlanToFront should move plan to index 0');
	}
	if (promotePlanToFront(ordered, 'a').map((p) => p.id).join(',') !== 'a,b,c') {
		throw new Error('promotePlanToFront should no-op when already first');
	}
	if (reorderPlanOrderIds(['a', 'b', 'c'], 'c', -1).join(',') !== 'a,c,b') {
		throw new Error('reorderPlanOrderIds should swap neighbors');
	}
	if (moveOrderIds(['a', 'b', 'c'], 0, 2).join(',') !== 'b,c,a') {
		throw new Error('moveOrderIds should move item to target index');
	}

	let movePlan = createEmptyDraft('Move');
	for (const id of ['ex-a', 'ex-b', 'ex-c', 'ex-d']) {
		movePlan = addExercise(movePlan, id).plan;
	}
	if (movePlan.exercises.map((ex) => ex.exerciseId).join(',') !== 'ex-a,ex-b,ex-c,ex-d') {
		throw new Error('movePlan seed failed');
	}
	const toStart = moveExercise(movePlan, 3, 0);
	if (toStart.exercises.map((ex) => ex.exerciseId).join(',') !== 'ex-d,ex-a,ex-b,ex-c') {
		throw new Error(`moveExercise to start unexpected ${toStart.exercises.map((ex) => ex.exerciseId).join(',')}`);
	}
	const toEnd = moveExercise(movePlan, 0, 3);
	if (toEnd.exercises.map((ex) => ex.exerciseId).join(',') !== 'ex-b,ex-c,ex-d,ex-a') {
		throw new Error(`moveExercise to end unexpected ${toEnd.exercises.map((ex) => ex.exerciseId).join(',')}`);
	}

	let groupedPlan = createEmptyDraft('Move');
	for (const id of ['ex-a', 'ex-b', 'ex-c', 'ex-d']) {
		groupedPlan = addExercise(groupedPlan, id).plan;
	}
	groupedPlan = formSuperset(groupedPlan, ['ex-b', 'ex-c']);
	if (groupedPlan.exercises.filter((ex) => ex.groupId).length !== 2) {
		throw new Error('movePlan group seed failed');
	}
	const blockToStart = moveExercise(groupedPlan, 2, 0);
	if (blockToStart.exercises.map((ex) => ex.exerciseId).join(',') !== 'ex-b,ex-c,ex-a,ex-d') {
		throw new Error(
			`moveExercise block to start unexpected ${blockToStart.exercises.map((ex) => ex.exerciseId).join(',')}`
		);
	}
	const blockToEnd = moveExercise(groupedPlan, 1, 3);
	if (blockToEnd.exercises.map((ex) => ex.exerciseId).join(',') !== 'ex-a,ex-d,ex-b,ex-c') {
		throw new Error(
			`moveExercise block to end unexpected ${blockToEnd.exercises.map((ex) => ex.exerciseId).join(',')}`
		);
	}
	const soloPastGroup = moveExercise(groupedPlan, 3, 2);
	if (soloPastGroup.exercises.map((ex) => ex.exerciseId).join(',') !== 'ex-a,ex-d,ex-b,ex-c') {
		throw new Error(
			`moveExercise solo past group unexpected ${soloPastGroup.exercises.map((ex) => ex.exerciseId).join(',')}`
		);
	}
}
