import { browser } from '$app/environment';
import { page } from '$app/stores';
import {
	LOCALE_STORAGE_KEY,
	detectBrowserLocale,
	isAppLocale,
	syncLocaleCookie,
	type AppLocale
} from '$lib/i18n/locale';
import { isEnglishPath, ruPath } from '$lib/seo/alternates';
import { goto } from '$app/navigation';
import { derived, writable } from 'svelte/store';

function bootLocale(): AppLocale {
	if (!browser) return 'ru';
	try {
		const fromDom = document.documentElement.dataset.locale;
		if (fromDom && isAppLocale(fromDom)) return fromDom;
		const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
		if (raw && isAppLocale(raw)) return raw;
		const detected = detectBrowserLocale();
		localStorage.setItem(LOCALE_STORAGE_KEY, detected);
		syncLocaleCookie(detected);
		return detected;
	} catch {
		return detectBrowserLocale();
	}
}

export function applyDocumentLang(locale: AppLocale) {
	if (!browser) return;
	document.documentElement.lang = locale;
	document.documentElement.dataset.locale = locale;
}

const initial = bootLocale();
/** Stored user preference: what app routes (`/`, `/builder`, ...) speak. */
const preferred = writable<AppLocale>(initial);

/**
 * Language switch in Profile / auth prefs / the language select.
 *
 * `/en/*` is a URL language, not a preference (see `resolvedLocale`), so
 * choosing Russian while on a mirror must leave the mirror; otherwise the
 * setting looks dead: the page keeps forcing English.
 */
export function setPreferredLocale(next: AppLocale) {
	preferred.set(next);
	if (!browser) return;
	try {
		localStorage.setItem(LOCALE_STORAGE_KEY, next);
	} catch {
		/* ignore */
	}
	applyDocumentLang(next);
	syncLocaleCookie(next);
	if (next === 'ru' && isEnglishPath(window.location.pathname)) {
		void goto(ruPath(window.location.pathname) + window.location.search);
	}
}

/**
 * Effective UI language.
 *
 * `/en/*` are public English mirrors of content pages. They speak English for
 * everyone, including prerendered HTML and a visitor whose stored preference
 * is Russian, so the shared `/en/...` link is consistent for crawlers and
 * humans. Every other route follows the stored preference, exactly as before.
 */
export const resolvedLocale = derived([page, preferred], ([$page, preference]) =>
	isEnglishPath($page.url.pathname) ? 'en' : preference
);

if (browser) {
	applyDocumentLang(initial);
	syncLocaleCookie(initial);
}
