import { catalogHubSitemapPaths } from '$lib/domain/catalogLinks';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

type ExerciseIndexRow = { id: string };
type ArticleRow = { slug: string; locale?: string };

export type SitemapEntry = {
	path: string;
	lastmod: string;
};

const STATIC_DIR = join(process.cwd(), 'static');

async function readJsonFile<T>(relativePath: string): Promise<T> {
	const raw = await readFile(join(STATIC_DIR, relativePath), 'utf-8');
	return JSON.parse(raw) as T;
}

async function fileLastmod(relativePath: string): Promise<string> {
	const fileStat = await stat(join(STATIC_DIR, relativePath));
	return formatSitemapDate(fileStat.mtime);
}

export function formatSitemapDate(value: Date): string {
	return value.toISOString().slice(0, 10);
}

export async function collectSitemapEntries(): Promise<SitemapEntry[]> {
	const [exercises, articles, exercisesLastmod, articlesLastmod] = await Promise.all([
		readJsonFile<ExerciseIndexRow[]>('data/exercises.index.json'),
		readJsonFile<ArticleRow[]>('content/articles.json'),
		fileLastmod('data/exercises.index.json'),
		fileLastmod('content/articles.json')
	]);

	const siteLastmod = exercisesLastmod > articlesLastmod ? exercisesLastmod : articlesLastmod;
	const entries = new Map<string, SitemapEntry>();

	const add = (path: string, lastmod: string) => {
		const existing = entries.get(path);
		if (!existing || existing.lastmod < lastmod) {
			entries.set(path, { path, lastmod });
		}
	};

	for (const path of ['/', '/exercises', '/articles', '/privacy', ...catalogHubSitemapPaths()]) {
		add(path, siteLastmod);
	}

	for (const row of exercises) {
		if (row.id) add(`/exercise/${encodeURIComponent(row.id)}`, exercisesLastmod);
	}

	const articleSlugs = new Set<string>();
	for (const row of articles) {
		if (row.slug) articleSlugs.add(row.slug);
	}
	for (const slug of articleSlugs) {
		add(`/articles/${encodeURIComponent(slug)}`, articlesLastmod);
	}

	return [...entries.values()].sort((a, b) => a.path.localeCompare(b.path));
}

/** @deprecated Use collectSitemapEntries(). */
export async function collectPublicPaths(): Promise<string[]> {
	const entries = await collectSitemapEntries();
	return entries.map((entry) => entry.path);
}

export function buildSitemapXml(origin: string, entries: SitemapEntry[]): string {
	const base = origin.replace(/\/$/, '');
	const urls = entries
		.map((entry) => {
			const loc = escapeXml(`${base}${entry.path}`);
			const lastmod = escapeXml(entry.lastmod);
			return `  <url><loc>${loc}</loc><lastmod>${lastmod}</lastmod></url>`;
		})
		.join('\n');
	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function escapeXml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}
