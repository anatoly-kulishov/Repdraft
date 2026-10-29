import type { WorkoutExercise, WorkoutPlan } from './types';
import { newId } from './id';
import { clampPlanName } from './inputLimits';
import { altGroupBounds } from './workoutGroups';
import { nowIso } from './workoutMutate';

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
			(ex.altGroupId ?? null) === (other.altGroupId ?? null) &&
			JSON.stringify(ex.repsScheme ?? null) === JSON.stringify(other.repsScheme ?? null)
		);
	});
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

/**
 * Rough session length for the home CTA: prescribed sets × (rest + ~30 s of
 * work), rounded to 5 minutes. "Or" blocks count once (first alternative).
 */
export function planEstimatedMinutes(plan: WorkoutPlan): number {
	let seconds = 0;
	let i = 0;
	const list = plan.exercises;
	while (i < list.length) {
		const ab = altGroupBounds(list, i);
		const sets = Math.max(0, list[i]?.sets ?? 0);
		seconds += sets * (Math.max(0, list[i]?.restSec ?? 0) + 30);
		i = ab && ab.start === i && ab.end > ab.start ? ab.end + 1 : i + 1;
	}
	if (seconds <= 0) return 0;
	const minutes = Math.round(seconds / 60 / 5) * 5;
	return Math.max(10, minutes);
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
 * Forward split rotation in stored list order (resolve when no pin).
 * After finish, pair with `rotatePlanToEnd` so the queue head matches the card under Next.
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

/** Move finished plan to the end of the athlete's list (rotation queue). */
export function rotatePlanToEnd<T extends { id: string }>(
	plans: readonly T[],
	finishedPlanId: string
): T[] {
	const idx = plans.findIndex((p) => p.id === finishedPlanId);
	if (idx < 0) return [...plans];
	const finished = plans[idx]!;
	return [...plans.slice(0, idx), ...plans.slice(idx + 1), finished];
}

export function rotatePlanIdToEnd(orderIds: readonly string[], planId: string): string[] {
	if (!orderIds.includes(planId)) return [...orderIds];
	return [...orderIds.filter((id) => id !== planId), planId];
}

/**
 * Storage index so a drop onto promoted «Следующая» places the row directly under it.
 * Next at front → insert at 1; Next mid-list → move to 0 so promote shows it under Next.
 */
export function storageIndexForDropOntoNext(
	orderIds: readonly string[],
	nextPlanId: string
): number {
	const nextIdx = orderIds.indexOf(nextPlanId);
	if (nextIdx < 0) return 0;
	return nextIdx <= 0 ? Math.min(1, Math.max(0, orderIds.length - 1)) : 0;
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

/**
 * After finishing `finishedPlanId`, advance pin unless user pinned a different plan.
 * Moves finished to end of a copy then takes the new head (card that sat under Next on screen).
 * Caller must persist the same rotation via `rotatePlanIdToEnd` on plan order.
 */
export function advanceHomeNextPlanId(
	plans: readonly { id: string }[],
	finishedPlanId: string,
	pinnedPlanId: string | null | undefined
): string | null {
	if (pinnedPlanId && pinnedPlanId !== finishedPlanId) return pinnedPlanId;
	const rotated = rotatePlanToEnd(plans, finishedPlanId);
	return rotated[0]?.id ?? null;
}

/** User-defined plan list order (localStorage ids). Unknown ids append at end (e.g. cloud sync). */
export function syncPlanOrderIds(orderIds: readonly string[], planIds: readonly string[]): string[] {
	const set = new Set(planIds);
	const seen = new Set<string>();
	const kept: string[] = [];
	for (const id of orderIds) {
		if (!set.has(id) || seen.has(id)) continue;
		seen.add(id);
		kept.push(id);
	}
	for (const id of planIds) {
		if (seen.has(id)) continue;
		seen.add(id);
		kept.push(id);
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
