/** SSR cookies so Saved/Records can skip card skeletons when the list is known empty. */

export const BOOKMARKS_COUNT_COOKIE = 'repdraft_bookmarks_count';
export const RECORDS_COUNT_COOKIE = 'repdraft_records_count';

const COOKIE_MAX = 9999;

export function parseListCountCookie(raw: string | undefined): number | null {
	if (raw == null || raw === '') return null;
	const n = Number.parseInt(raw, 10);
	if (!Number.isFinite(n) || n < 0) return null;
	return Math.min(n, COOKIE_MAX);
}

export function syncBookmarksCountCookie(count: number): void {
	if (typeof document === 'undefined') return;
	try {
		const safe = Math.min(Math.max(Math.floor(count), 0), COOKIE_MAX);
		document.cookie = `${BOOKMARKS_COUNT_COOKIE}=${safe}; path=/; Max-Age=31536000; SameSite=Lax`;
	} catch {
		/* ignore */
	}
}

export function syncRecordsCountCookie(count: number): void {
	if (typeof document === 'undefined') return;
	try {
		const safe = Math.min(Math.max(Math.floor(count), 0), COOKIE_MAX);
		document.cookie = `${RECORDS_COUNT_COOKIE}=${safe}; path=/; Max-Age=31536000; SameSite=Lax`;
	} catch {
		/* ignore */
	}
}
