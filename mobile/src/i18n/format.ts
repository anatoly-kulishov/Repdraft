import type { Locale } from './messages';
import { t } from './messages';

function localeTag(lang: Locale): string {
	return lang === 'ru' ? 'ru-RU' : 'en-US';
}

function formatWeekdayShort(date: Date, lang: Locale): string {
	try {
		return new Intl.DateTimeFormat(localeTag(lang), { weekday: 'short' })
			.format(date)
			.replace(/\.$/, '');
	} catch {
		return '';
	}
}

export function formatShortDate(iso: string, lang: Locale): string {
	try {
		const d = new Date(iso);
		const weekday = formatWeekdayShort(d, lang);
		const dayMonth = new Intl.DateTimeFormat(localeTag(lang), {
			day: 'numeric',
			month: 'short'
		}).format(d);
		return weekday ? `${weekday}, ${dayMonth}` : dayMonth;
	} catch {
		return iso;
	}
}

/** Same buckets as web `formatRelativeDay`. */
export function formatRelativeDay(iso: string, lang: Locale): string {
	const d = new Date(iso);
	const now = new Date();
	const dayMs = 86_400_000;
	const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
	const startThat = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
	const diffDays = Math.round((startToday - startThat) / dayMs);
	if (diffDays === 0) return t(lang, 'home.today');
	if (diffDays === 1) return t(lang, 'home.yesterday');
	if (diffDays > 1 && diffDays < 8) {
		const weekday = formatWeekdayShort(d, lang);
		const ago = t(lang, 'home.daysAgo', { n: diffDays });
		return weekday ? `${weekday}, ${ago}` : ago;
	}
	return formatShortDate(iso, lang);
}
