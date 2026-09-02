export type AppLocale = 'ru' | 'en';

export const LOCALE_STORAGE_KEY = 'repdraft.locale';

const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isAppLocale(value: string): value is AppLocale {
	return value === 'ru' || value === 'en';
}

function pickLocaleFromTags(tags: string[]): AppLocale {
	for (const tag of tags) {
		const lang = tag.toLowerCase();
		if (lang.startsWith('ru')) return 'ru';
	}
	return 'en';
}

export function localeFromAcceptLanguage(header: string | null | undefined): AppLocale {
	if (!header?.trim()) return 'ru';
	const tags = header
		.split(',')
		.map((part) => part.trim().split(';')[0] ?? '')
		.filter(Boolean);
	return pickLocaleFromTags(tags);
}

export function detectBrowserLocale(): AppLocale {
	if (typeof navigator === 'undefined') return 'ru';
	const candidates = [navigator.language, ...(navigator.languages ?? [])].filter(Boolean);
	return pickLocaleFromTags(candidates);
}

export function resolveRequestLocale(
	cookieValue: string | undefined,
	acceptLanguage: string | null | undefined
): AppLocale {
	if (cookieValue && isAppLocale(cookieValue)) return cookieValue;
	return localeFromAcceptLanguage(acceptLanguage);
}

/** Keep SSR meta aligned with the in-app locale preference. */
export function syncLocaleCookie(locale: AppLocale): void {
	if (typeof document === 'undefined') return;
	try {
		document.cookie = `${LOCALE_STORAGE_KEY}=${locale}; path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`;
	} catch {
		/* ignore */
	}
}
