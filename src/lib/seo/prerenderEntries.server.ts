import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function articlePrerenderEntries(): { slug: string }[] {
	const raw = readFileSync(join(process.cwd(), 'static/content/articles.json'), 'utf-8');
	const articles = JSON.parse(raw) as { slug: string }[];
	const slugs = [...new Set(articles.map((row) => row.slug).filter(Boolean))];
	return slugs.map((slug) => ({ slug }));
}
