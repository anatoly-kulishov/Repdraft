import type { LayoutLoad } from './$types';
import { browser } from '$app/environment';
import {
	LOCALE_STORAGE_KEY,
	detectBrowserLocale,
	isAppLocale,
	type AppLocale
} from '$lib/i18n/locale';

/**
 * Capacitor static SPA: no SSR (PUBLIC_APP_NATIVE is inlined by vite define).
 * Do not use process.env.APP_TARGET here — Vite replaces process.env with {} and ssr stays true.
 */
export const ssr =
	import.meta.env.PUBLIC_APP_NATIVE !== '1' && import.meta.env.PUBLIC_APP_NATIVE !== 'true';

function clientLocale(): AppLocale {
	if (!browser) return 'ru';
	try {
		const fromDom = document.documentElement.dataset.locale;
		if (fromDom && isAppLocale(fromDom)) return fromDom;
		const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
		if (raw && isAppLocale(raw)) return raw;
	} catch {
		/* ignore */
	}
	return detectBrowserLocale();
}

/**
 * Web: seoLocale from +layout.server (cookie / Accept-Language).
 * Native SPA: no server layout — use localStorage / navigator.
 */
export const load: LayoutLoad = ({ data }) => ({
	...data,
	seoLocale: data.seoLocale ?? clientLocale()
});
