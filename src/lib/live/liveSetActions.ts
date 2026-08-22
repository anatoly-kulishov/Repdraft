import {
	coerceReps,
	coerceWeightKg,
	filterRepsInput,
	filterWeightInput,
	LIVE_REPS
} from '$lib/domain/inputLimits';
import {
	isSessionFullyLogged,
	nextFocusAfterSetComplete
} from '$lib/domain/session';
import type { WorkoutSession } from '$lib/domain/types';
import { unlockAudioFromGesture, vibrateSetDone } from '$lib/domain/prefs';
import { get } from 'svelte/store';

export type LiveSetActionsDeps = {
	getSession: () => WorkoutSession | null;
	patchSet: (
		ei: number,
		si: number,
		patch: { weightKg?: number | null; reps?: number | null; completed?: boolean }
	) => void;
	setSetsCompleted: (ei: number, indexes: number[], completed: boolean) => void;
	skipRest: () => void;
	getRestUntil: () => number | null;
	showToast: (message: string, kind: 'error' | 'success') => void;
	invalidWeightMsg: string;
	invalidRepsMsg: string;
	setInvalid: (si: number | null, kind: 'weight' | 'reps' | null) => void;
	clearInvalidIf: (si: number) => void;
	setSelectedExerciseIndex: (index: number) => void;
	setJustDoneSetIndex: (si: number | null) => void;
	setRestChimeArmed: (armed: boolean) => void;
	openFinishOffer: () => void;
};

export function createLiveSetActions(deps: LiveSetActionsDeps) {
	function onWeight(ei: number, si: number, value: string): string {
		deps.clearInvalidIf(si);
		const prev = deps.getSession()?.exercises[ei]?.sets[si]?.weightKg;
		const filtered = filterWeightInput(value, prev != null ? String(prev) : '');
		if (!filtered) {
			deps.patchSet(ei, si, { weightKg: null });
			return filtered;
		}
		const n = coerceWeightKg(filtered);
		if (n == null) {
			deps.patchSet(ei, si, { weightKg: null });
			return '';
		}
		deps.patchSet(ei, si, { weightKg: n });
		return filtered;
	}

	function onReps(ei: number, si: number, value: string): string {
		deps.clearInvalidIf(si);
		const prev = deps.getSession()?.exercises[ei]?.sets[si]?.reps;
		const filtered = filterRepsInput(value, LIVE_REPS, prev != null ? String(prev) : '');
		if (!filtered) {
			deps.patchSet(ei, si, { reps: null });
			return filtered;
		}
		const n = coerceReps(filtered, LIVE_REPS);
		if (n == null) {
			deps.patchSet(ei, si, { reps: null });
			return '';
		}
		deps.patchSet(ei, si, { reps: n });
		return filtered;
	}

	function afterSetComplete(ei: number, si: number) {
		deps.setRestChimeArmed(deps.getRestUntil() != null);
		if (deps.getRestUntil() != null) unlockAudioFromGesture();
		deps.setJustDoneSetIndex(si);
		const next = deps.getSession();
		if (!next) return;
		deps.setSelectedExerciseIndex(nextFocusAfterSetComplete(next, ei, si));
		if (isSessionFullyLogged(next)) {
			deps.skipRest();
			deps.setRestChimeArmed(false);
			deps.openFinishOffer();
		}
	}

	function onComplete(ei: number, si: number) {
		const ex = deps.getSession()?.exercises[ei];
		const set = ex?.sets[si];
		if (!set) return;
		if (set.weightKg != null && !coerceWeightKg(String(set.weightKg))) {
			deps.showToast(deps.invalidWeightMsg, 'error');
			deps.setInvalid(si, 'weight');
			return;
		}
		if (
			set.reps == null ||
			!Number.isInteger(set.reps) ||
			set.reps < LIVE_REPS.min ||
			set.reps > LIVE_REPS.max
		) {
			deps.showToast(deps.invalidRepsMsg, 'error');
			deps.setInvalid(si, 'reps');
			return;
		}
		deps.setInvalid(null, null);
		if (typeof document !== 'undefined') {
			const active = document.activeElement;
			if (active instanceof HTMLElement) active.blur();
		}
		unlockAudioFromGesture();
		vibrateSetDone();
		deps.patchSet(ei, si, { completed: true });
		afterSetComplete(ei, si);
	}

	function onToggleAllComplete(ei: number) {
		const ex = deps.getSession()?.exercises[ei];
		if (!ex?.sets.length) return;
		if (ex.sets.every((s) => s.completed)) {
			deps.setJustDoneSetIndex(null);
			deps.setInvalid(null, null);
			deps.setSetsCompleted(
				ei,
				ex.sets.map((_, si) => si),
				false
			);
			deps.setRestChimeArmed(false);
			return;
		}
		for (let si = 0; si < ex.sets.length; si++) {
			const set = ex.sets[si]!;
			if (set.completed) continue;
			if (set.weightKg != null && !coerceWeightKg(String(set.weightKg))) {
				deps.showToast(deps.invalidWeightMsg, 'error');
				deps.setInvalid(si, 'weight');
				return;
			}
			if (
				set.reps == null ||
				!Number.isInteger(set.reps) ||
				set.reps < LIVE_REPS.min ||
				set.reps > LIVE_REPS.max
			) {
				deps.showToast(deps.invalidRepsMsg, 'error');
				deps.setInvalid(si, 'reps');
				return;
			}
		}
		const openIndexes = ex.sets.map((s, si) => (s.completed ? -1 : si)).filter((si) => si >= 0);
		if (openIndexes.length === 0) return;
		deps.setInvalid(null, null);
		unlockAudioFromGesture();
		deps.setSetsCompleted(ei, openIndexes, true);
		deps.setRestChimeArmed(deps.getRestUntil() != null);
		if (deps.getRestUntil() != null) unlockAudioFromGesture();
		const lastSi = openIndexes[openIndexes.length - 1]!;
		afterSetComplete(ei, lastSi);
	}

	return { onWeight, onReps, onComplete, onToggleAllComplete };
}
