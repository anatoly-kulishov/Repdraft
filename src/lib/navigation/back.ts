import { browser } from '$app/environment';
import { goto } from '$app/navigation';

/** Prefer browser history (swipe-back parity); fall back when stack has no prior entry. */
export function navigateBack(fallbackHref: string): void {
	if (!browser) {
		void goto(fallbackHref);
		return;
	}
	// ponytail: history.length is coarse; good enough once replaceState is reserved for redirects.
	if (window.history.length > 1) {
		window.history.back();
		return;
	}
	void goto(fallbackHref);
}
