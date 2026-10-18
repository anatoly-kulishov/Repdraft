import type { WorkoutSession } from './types';
import { groupBounds, altGroupBounds } from './workout';

export function visibleSessionExerciseIndices(session: WorkoutSession): number[] {
	const choices = session.altChoices ?? {};
	const out: number[] = [];
	let i = 0;
	const list = session.exercises;
	while (i < list.length) {
		const ex = list[i];
		if (ex?.skipped) {
			i += 1;
			continue;
		}
		const ab = altGroupBounds(list, i);
		if (ab && ab.start === i && ab.end > ab.start) {
			const chosenId = choices[ab.altGroupId];
			if (chosenId) {
				const idx = list.findIndex(
					(item, ei) =>
						ei >= ab.start && ei <= ab.end && item.exerciseId === chosenId && !item.skipped
				);
				out.push(idx >= 0 ? idx : ab.start);
			} else {
				out.push(ab.start);
			}
			i = ab.end + 1;
			continue;
		}
		out.push(i);
		i += 1;
	}
	return out;
}

export function altGroupNeedsPick(session: WorkoutSession, exerciseIndex: number): boolean {
	const ab = altGroupBounds(session.exercises, exerciseIndex);
	if (!ab || ab.start === ab.end) return false;
	return !(session.altChoices ?? {})[ab.altGroupId];
}

export function chooseAltExercise(
	session: WorkoutSession,
	altGroupId: string,
	exerciseId: string
): WorkoutSession {
	const members = session.exercises.filter((ex) => ex.altGroupId === altGroupId);
	if (!members.some((ex) => ex.exerciseId === exerciseId)) return session;
	const prev = (session.altChoices ?? {})[altGroupId];
	if (prev === exerciseId) return session;
	const prevEx = prev ? members.find((ex) => ex.exerciseId === prev) : null;
	if (prevEx?.sets.some((s) => s.completed)) return session;
	return {
		...session,
		altChoices: { ...(session.altChoices ?? {}), [altGroupId]: exerciseId }
	};
}

/** Drop unchosen “or” members before history write. */
export function pruneUnchosenAlts(session: WorkoutSession): WorkoutSession {
	const choices = session.altChoices ?? {};
	const exercises = session.exercises.filter((ex) => {
		if (!ex.altGroupId) return true;
		const chosen = choices[ex.altGroupId];
		if (!chosen) {
			return ex.sets.some((s) => s.completed);
		}
		return ex.exerciseId === chosen;
	});
	return { ...session, exercises, altChoices: undefined };
}

function nextVisibleAfterIndex(session: WorkoutSession, fromIndex: number): number | null {
	const visible = visibleSessionExerciseIndices(session);
	const pos = visible.indexOf(fromIndex);
	if (pos >= 0 && pos + 1 < visible.length) return visible[pos + 1]!;
	return visible.find((i) => i > fromIndex) ?? null;
}

/** First visible exercise after a contiguous superset / block. */
function nextVisibleAfterGroupEnd(session: WorkoutSession, groupEnd: number): number {
	return nextVisibleAfterIndex(session, groupEnd) ?? groupEnd;
}

function isVisibleSessionExercise(session: WorkoutSession, index: number): boolean {
	return visibleSessionExerciseIndices(session).includes(index);
}

function nextIncompleteInGroup(
	session: WorkoutSession,
	bounds: { start: number; end: number },
	fromIndex: number
): number | null {
	for (let i = fromIndex + 1; i <= bounds.end; i++) {
		if (!isVisibleSessionExercise(session, i)) continue;
		const ex = session.exercises[i];
		if (ex?.sets.some((s) => !s.completed)) return i;
	}
	for (let i = bounds.start; i < fromIndex; i++) {
		if (!isVisibleSessionExercise(session, i)) continue;
		const ex = session.exercises[i];
		if (ex?.sets.some((s) => !s.completed)) return i;
	}
	return null;
}

/**
 * “Next exercise” button: stay inside an open incomplete superset; otherwise always
 * advance to the next visible exercise (user intent — even if current sets are open).
 */
export function nextManualExerciseFocus(session: WorkoutSession, exerciseIndex: number): number {
	const n = session.exercises.length;
	if (n === 0) return 0;
	const idx = Number.isFinite(exerciseIndex)
		? Math.max(0, Math.min(Math.trunc(exerciseIndex), n - 1))
		: 0;
	const bounds = groupBounds(session.exercises, idx);
	if (bounds && bounds.start !== bounds.end) {
		const inside = nextIncompleteInGroup(session, bounds, idx);
		if (inside != null) return inside;
		return nextVisibleAfterGroupEnd(session, bounds.end);
	}

	const next = nextVisibleAfterIndex(session, idx);
	if (next != null) return next;
	return idx;
}

/**
 * After completing set `setIndex` on `exerciseIndex`, pick the next exercise to focus.
 * Supersets go round-robin (A1 → B1 → C1 → A2…); solos advance when all sets are done.
 */
export function nextFocusAfterSetComplete(
	session: WorkoutSession,
	exerciseIndex: number,
	setIndex: number
): number {
	const bounds = groupBounds(session.exercises, exerciseIndex);
	if (bounds && bounds.start !== bounds.end) {
		for (let i = exerciseIndex + 1; i <= bounds.end; i++) {
			if (!isVisibleSessionExercise(session, i)) continue;
			const set = session.exercises[i]?.sets[setIndex];
			if (set && !set.completed) return i;
		}
		for (let i = bounds.start; i < exerciseIndex; i++) {
			if (!isVisibleSessionExercise(session, i)) continue;
			const set = session.exercises[i]?.sets[setIndex];
			if (set && !set.completed) return i;
		}
		for (let s = setIndex + 1; ; s++) {
			let sawSlot = false;
			for (let i = bounds.start; i <= bounds.end; i++) {
				if (!isVisibleSessionExercise(session, i)) continue;
				const set = session.exercises[i]?.sets[s];
				if (!set) continue;
				sawSlot = true;
				if (!set.completed) return i;
			}
			if (!sawSlot) break;
		}
		return nextVisibleAfterGroupEnd(session, bounds.end);
	}

	const ex = session.exercises[exerciseIndex];
	if (ex && ex.sets.length > 0 && ex.sets.every((s) => s.completed)) {
		const next = nextVisibleAfterIndex(session, exerciseIndex);
		if (next != null) return next;
	}
	return exerciseIndex;
}
