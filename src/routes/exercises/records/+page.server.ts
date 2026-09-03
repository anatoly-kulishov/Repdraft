import type { PageServerLoad } from './$types';
import { RECORDS_COUNT_COOKIE, parseListCountCookie } from '$lib/storage/listBootPeek';

/** Cookie peek from app.html / localRecordRepository for empty-vs-skeleton SSR. */
export const load: PageServerLoad = ({ cookies }) => ({
	recordsCountPeek: parseListCountCookie(cookies.get(RECORDS_COUNT_COOKIE))
});
