import { browser } from '$app/environment';
import {
	LOCALE_STORAGE_KEY,
	detectBrowserLocale,
	isAppLocale,
	type AppLocale
} from '$lib/i18n/locale';
import { writable } from 'svelte/store';

function bootLocale(): AppLocale {
	if (!browser) return 'ru';
	try {
		const fromDom = document.documentElement.dataset.locale;
		if (fromDom && isAppLocale(fromDom)) return fromDom;
		const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
		if (raw && isAppLocale(raw)) return raw;
		const detected = detectBrowserLocale();
		localStorage.setItem(LOCALE_STORAGE_KEY, detected);
		return detected;
	} catch {
		return detectBrowserLocale();
	}
}

function applyDocumentLang(locale: AppLocale) {
	if (!browser) return;
	document.documentElement.lang = locale;
	document.documentElement.dataset.locale = locale;
}

const initial = bootLocale();
const localeStore = writable<AppLocale>(initial);

export const resolvedLocale = {
	subscribe: localeStore.subscribe,
	set(next: AppLocale) {
		localeStore.set(next);
		if (!browser) return;
		try {
			localStorage.setItem(LOCALE_STORAGE_KEY, next);
		} catch {
			/* ignore */
		}
		applyDocumentLang(next);
	}
};

if (browser) {
	applyDocumentLang(initial);
}
