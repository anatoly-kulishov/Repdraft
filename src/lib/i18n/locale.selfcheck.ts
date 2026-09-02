import {
	isAppLocale,
	localeFromAcceptLanguage,
	resolveRequestLocale
} from '$lib/i18n/locale';

function assert(condition: boolean, message: string): void {
	if (!condition) throw new Error(message);
}

assert(isAppLocale('ru'), 'ru is locale');
assert(!isAppLocale('de'), 'de is not locale');
assert(localeFromAcceptLanguage('en-US,en;q=0.9') === 'en', 'accept en');
assert(localeFromAcceptLanguage('ru-RU,ru;q=0.9,en;q=0.8') === 'ru', 'accept ru first');
assert(resolveRequestLocale('en', 'ru-RU') === 'en', 'cookie wins');
assert(resolveRequestLocale(undefined, 'ru-RU') === 'ru', 'header fallback');

console.log('locale.selfcheck: ok');
