import type { Article } from '$lib/domain/articles';
import type { AppLocale } from '$lib/i18n/locale';

let cache: Article[] | null = null;

export async function loadArticles(fetchFn: typeof fetch = fetch): Promise<Article[]> {
	if (cache) return cache;
	const res = await fetchFn('/content/articles.json');
	if (!res.ok) return [];
	cache = (await res.json()) as Article[];
	return cache;
}

export async function loadArticleBySlug(
	slug: string,
	fetchFn: typeof fetch = fetch
): Promise<Article | null> {
	const articles = await loadArticles(fetchFn);
	return articles.find((a) => a.slug === slug) ?? null;
}

export async function loadArticlesForLocale(
	locale: AppLocale,
	fetchFn: typeof fetch = fetch
): Promise<Article[]> {
	const articles = await loadArticles(fetchFn);
	return articles.filter((a) => a.locale === locale);
}
