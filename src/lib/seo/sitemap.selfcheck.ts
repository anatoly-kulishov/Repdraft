import { formatSitemapDate } from '$lib/seo/sitemap';

function assert(condition: boolean, message: string): void {
	if (!condition) throw new Error(message);
}

const sample = formatSitemapDate(new Date('2026-09-02T12:34:56.000Z'));
assert(sample === '2026-09-02', 'sitemap date is YYYY-MM-DD');

console.log('sitemap.selfcheck: ok');
