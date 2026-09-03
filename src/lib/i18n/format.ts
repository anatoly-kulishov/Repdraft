import type { AppLocale } from './locale';
import { translate } from './messages';

function localeTag(lang: AppLocale): string {
	return lang === 'ru' ? 'ru-RU' : 'en-US';
}

export function formatShortDate(iso: string, lang: AppLocale): string {
	try {
		return new Intl.DateTimeFormat(localeTag(lang), {
			day: 'numeric',
			month: 'short'
		}).format(new Date(iso));
	} catch {
		return iso;
	}
}

export function formatLongDate(iso: string, lang: AppLocale): string {
	try {
		return new Intl.DateTimeFormat(localeTag(lang), {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		}).format(new Date(iso));
	} catch {
		return iso;
	}
}

export function formatRelativeDay(iso: string, lang: AppLocale): string {
	const d = new Date(iso);
	const now = new Date();
	const dayMs = 86_400_000;
	const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
	const startThat = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
	const diffDays = Math.round((startToday - startThat) / dayMs);
	if (diffDays === 0) return translate(lang, 'home.today');
	if (diffDays === 1) return translate(lang, 'home.yesterday');
	if (diffDays > 1 && diffDays < 8) {
		return translate(lang, 'home.daysAgo', { n: diffDays });
	}
	return formatShortDate(iso, lang);
}

/** Local calendar day as `YYYY-MM-DD` (history filters / date input). */
export function toLocalDayKey(isoOrDate: string | Date = new Date()): string {
	const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
	if (Number.isNaN(d.getTime())) return '';
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

/** Format `YYYY-MM-DD` in the user's locale without UTC day-shift. */
export function formatLocalDayKey(dayKey: string, lang: AppLocale): string {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
	if (!m) return dayKey;
	const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
	try {
		return new Intl.DateTimeFormat(localeTag(lang), {
			day: 'numeric',
			month: 'short'
		}).format(date);
	} catch {
		return dayKey;
	}
}

/** Short inclusive range label; same day collapses to one date. Uses ASCII hyphen. */
export function formatLocalDayRange(from: string, to: string, lang: AppLocale): string {
	if (!from) return '';
	const end = to || from;
	if (from === end) return formatLocalDayKey(from, lang);
	return `${formatLocalDayKey(from, lang)} - ${formatLocalDayKey(end, lang)}`;
}

/** Start of local day N calendar days before today (0 = today). */
export function localDayStartMs(daysAgo = 0): number {
	const now = new Date();
	const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	start.setDate(start.getDate() - daysAgo);
	return start.getTime();
}

/** mm:ss, or h:mm:ss when extended and over an hour. */
export function formatDurationMs(ms: number | null, opts?: { extended?: boolean }): string {
	if (ms == null) return '-';
	const totalSec = Math.max(0, Math.floor(ms / 1000));
	const h = Math.floor(totalSec / 3600);
	const m = Math.floor((totalSec % 3600) / 60);
	const s = totalSec % 60;
	if (opts?.extended && h > 0) {
		return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	}
	return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatDurationMinutes(ms: number | null): number | null {
	if (ms == null) return null;
	return Math.max(1, Math.round(ms / 60_000));
}

export function formatElapsedClock(ms: number): string {
	return formatDurationMs(ms, { extended: true });
}

export function formatRestSec(totalSec: number): string {
	const m = Math.floor(totalSec / 60);
	const s = totalSec % 60;
	return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
