import type { LayoutLoad } from './$types';
import { browser } from '$app/environment';
import {
	LOCALE_STORAGE_KEY,
	detectBrowserLocale,
	isAppLocale,
	type AppLocale
} from '$lib/i18n/locale';

export const ssr = true;

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

/** seoLocale from +layout.server (cookie / Accept-Language), else client locale. */
export const load: LayoutLoad = ({ data }) => ({
	...data,
	seoLocale: data.seoLocale ?? clientLocale()
});
