import { error } from '@sveltejs/kit';
import { loadArticleVariantsBySlug } from '$lib/data/loadArticles';
import { isAppLocale } from '$lib/i18n/locale';
import { ARTICLE_OG_HEIGHT, ARTICLE_OG_WIDTH, buildArticleOgSvg } from '$lib/seo/articleOg';
import { articlePrerenderEntries } from '$lib/seo/prerenderEntries.server';
import { PRERENDER_PUBLIC } from '$lib/seo/prerenderPublic';
import { readSearchParam } from '$lib/navigation/urlSearchParams';
import type { RequestHandler } from './$types';

export const prerender = PRERENDER_PUBLIC;

export function entries() {
	return articlePrerenderEntries();
}

export const GET: RequestHandler = async ({ params, url, fetch }) => {
	const variants = await loadArticleVariantsBySlug(params.slug, fetch);
	if (variants.length === 0) error(404, 'Not found');

	const localeParam = readSearchParam(url, 'locale');
	const locale =
		localeParam && isAppLocale(localeParam)
			? localeParam
			: variants.find((a) => a.locale === 'ru')?.locale ?? variants[0]!.locale;

	const article =
		variants.find((a) => a.locale === locale) ??
		variants.find((a) => a.locale === 'ru') ??
		variants[0]!;

	const svg = buildArticleOgSvg(article);

	return new Response(svg, {
		headers: {
			'Content-Type': 'image/svg+xml; charset=utf-8',
			'Cache-Control': 'public, max-age=86400',
			'X-Article-Og-Width': String(ARTICLE_OG_WIDTH),
			'X-Article-Og-Height': String(ARTICLE_OG_HEIGHT)
		}
	});
};
