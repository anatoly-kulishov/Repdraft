import { writable } from 'svelte/store';

/**
 * Shared view-transition-name for catalog card media ↔ exercise detail hero.
 * Prefix required: exercise ids are numeric; CSS custom-ident cannot start with a digit.
 *
 * Only the armed card gets the name (weak-device safe). Detail hero always names itself.
 * Arm on card pointerdown, and while on detail so reverse morph can match.
 */
export const armedExerciseMediaVtId = writable<string | null>(null);

export function exerciseMediaViewTransitionName(exerciseId: string): string {
	return `rd-ex-${exerciseId}`;
}

export function armExerciseMediaViewTransition(exerciseId: string): void {
	armedExerciseMediaVtId.set(exerciseId);
}

export function clearArmedExerciseMediaViewTransition(): void {
	armedExerciseMediaVtId.set(null);
}
