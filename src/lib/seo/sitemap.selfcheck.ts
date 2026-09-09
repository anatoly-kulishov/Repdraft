import { collectSitemapEntries, formatSitemapDate } from '$lib/seo/sitemap';

function assert(condition: boolean, message: string): void {
	if (!condition) throw new Error(message);
}

const sample = formatSitemapDate(new Date('2026-09-02T12:34:56.000Z'));
assert(sample === '2026-09-02', 'sitemap date is YYYY-MM-DD');

const entries = await collectSitemapEntries();
const paths = new Set(entries.map((e) => e.path));
for (const required of ['/', '/privacy', '/terms', '/exercises', '/articles']) {
	assert(paths.has(required), `sitemap includes ${required}`);
}

console.log('sitemap.selfcheck: ok');
