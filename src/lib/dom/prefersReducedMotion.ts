/** True when the OS asks for reduced motion (a11y / battery saver). */
export function prefersReducedMotion(): boolean {
	return (
		typeof window !== 'undefined' &&
		window.matchMedia('(prefers-reduced-motion: reduce)').matches
	);
}

/** Prefer instant scroll when reduced motion is on. */
export function scrollBehavior(): ScrollBehavior {
	return prefersReducedMotion() ? 'auto' : 'smooth';
}
