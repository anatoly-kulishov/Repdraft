import {
	detectBrowserLocale,
	isAppLocale,
	LOCALE_STORAGE_KEY,
	type AppLocale
} from '$lib/i18n/locale';
import { browser } from '$app/environment';

/** SSR uses layout cookie/header; client uses the live locale store. */
export function resolveSeoLang(serverLocale: AppLocale | undefined, clientLocale: AppLocale): AppLocale {
	if (browser) return clientLocale;
	return serverLocale ?? detectBrowserLocale();
}

export { LOCALE_STORAGE_KEY as LOCALE_COOKIE_NAME };
