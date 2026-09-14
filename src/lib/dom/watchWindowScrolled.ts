import { browser } from '$app/environment';

/**
 * Notify when document scroll leaves the top (scrollY > 0).
 * Returns unsubscribe. No-op cleanup on SSR.
 */
export function watchWindowScrolled(onChange: (scrolled: boolean) => void): () => void {
	if (!browser) {
		onChange(false);
		return () => {};
	}

	let last: boolean | null = null;
	const update = () => {
		const y = window.scrollY || document.documentElement.scrollTop || 0;
		const scrolled = y > 0;
		if (last === scrolled) return;
		last = scrolled;
		onChange(scrolled);
	};

	update();
	window.addEventListener('scroll', update, { passive: true });
	return () => window.removeEventListener('scroll', update);
}
