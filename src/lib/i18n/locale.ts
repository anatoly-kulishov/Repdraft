export type AppLocale = 'ru' | 'en';

export const LOCALE_STORAGE_KEY = 'repdraft.locale';

export function isAppLocale(value: string): value is AppLocale {
	return value === 'ru' || value === 'en';
}

export function detectBrowserLocale(): AppLocale {
	if (typeof navigator === 'undefined') return 'ru';
	const candidates = [navigator.language, ...(navigator.languages ?? [])]
		.filter(Boolean)
		.map((l) => l.toLowerCase());

	for (const lang of candidates) {
		if (lang.startsWith('ru')) return 'ru';
	}
	return 'en';
}
