/** Session cache: media URLs that already faded in (stops remount flash on swipe-back). */

const fadedIn = new Set<string>();

export function hasFadedInMedia(src: string): boolean {
	return fadedIn.has(src);
}

export function markFadedInMedia(src: string): void {
	if (src) fadedIn.add(src);
}
