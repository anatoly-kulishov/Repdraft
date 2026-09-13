/** Delay before mounting page skeletons to avoid FOLS on fast local/cache boots. */
export const SKELETON_SHOW_DELAY_MS = 220;

/**
 * Becomes true only if `getActive()` stays true for `delayMs`.
 * Clears immediately when `getActive()` is false (skeleton never mounts on fast resolves).
 *
 * Call once during component init; read via `.current` in templates.
 */
export function createDelayedTrue(
	getActive: () => boolean,
	delayMs = SKELETON_SHOW_DELAY_MS
): { readonly current: boolean } {
	let shown = $state(false);

	$effect(() => {
		if (!getActive()) {
			shown = false;
			return;
		}
		const timer = setTimeout(() => {
			shown = true;
		}, delayMs);
		return () => clearTimeout(timer);
	});

	return {
		get current() {
			return shown;
		}
	};
}
