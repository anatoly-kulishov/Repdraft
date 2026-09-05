import { writable } from 'svelte/store';

/**
 * Immersive flow routes hide tabbar + logo header.
 * Pages set this when showing empty/missing so the user is not stuck without chrome.
 */
export const forceNormalShell = writable(false);

/**
 * Sync the force-normal-shell store. Use inside a Svelte 5 `$effect`:
 *
 *   $effect(() => syncForceNormalShell(!loading && (missing || !plan)));
 */
export function syncForceNormalShell(needNormal: boolean): () => void {
	forceNormalShell.set(needNormal);
	return () => forceNormalShell.set(false);
}
