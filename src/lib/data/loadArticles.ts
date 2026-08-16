import type { Article } from '$lib/domain/articles';
import type { AppLocale } from '$lib/i18n/locale';

/** In-memory cache for the current request graph; always refreshed when empty/stale. */
let cache: Article[] | null = null;

export async function loadArticles(fetchFn: typeof fetch = fetch): Promise<Article[]> {
	try {
		const res = await fetchFn('/content/articles.json', { cache: 'no-store' });
		if (!res.ok) return cache ?? [];
		const data = (await res.json()) as Article[];
		if (Array.isArray(data) && data.length > 0) {
			cache = data;
			return data;
		}
		return cache ?? [];
	} catch {
		return cache ?? [];
	}
}

export async function loadArticleBySlug(
	slug: string,
	fetchFn: typeof fetch = fetch,
	locale?: AppLocale
): Promise<Article | null> {
	const articles = await loadArticles(fetchFn);
	const matches = articles.filter((a) => a.slug === slug);
	if (matches.length === 0) return null;
	if (locale) {
		return matches.find((a) => a.locale === locale) ?? matches[0] ?? null;
	}
	return matches[0] ?? null;
}

/** All locale variants for a slug (for client-side locale switch). */
export async function loadArticleVariantsBySlug(
	slug: string,
	fetchFn: typeof fetch = fetch
): Promise<Article[]> {
	const articles = await loadArticles(fetchFn);
	return articles.filter((a) => a.slug === slug);
}

export async function loadArticlesForLocale(
	locale: AppLocale,
	fetchFn: typeof fetch = fetch
): Promise<Article[]> {
	const articles = await loadArticles(fetchFn);
	const forLocale = articles.filter((a) => a.locale === locale);
	if (forLocale.length > 0) return forLocale;
	return articles.filter((a) => a.locale === 'ru');
}
