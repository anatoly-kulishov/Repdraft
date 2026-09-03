import type { PageServerLoad } from './$types';
import { BOOKMARKS_COUNT_COOKIE, parseListCountCookie } from '$lib/storage/listBootPeek';

/** Cookie peek from app.html / localBookmarkRepository for empty-vs-skeleton SSR. */
export const load: PageServerLoad = ({ cookies }) => ({
	bookmarksCountPeek: parseListCountCookie(cookies.get(BOOKMARKS_COUNT_COOKIE))
});
