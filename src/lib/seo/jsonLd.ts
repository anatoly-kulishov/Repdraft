import type { AppLocale } from '$lib/i18n/locale';
import type { Article } from '$lib/domain/articles';
import type { Exercise } from '$lib/domain/types';
import { exerciseName } from '$lib/domain/exerciseName';
import { SITE_NAME, absoluteUrl } from '$lib/seo/site';
import { articleOgPath } from '$lib/seo/articleOg';

type JsonLd = Record<string, unknown>;

function orgPublisher(origin: string): JsonLd {
	return {
		'@type': 'Organization',
		name: SITE_NAME,
		url: origin,
		logo: {
			'@type': 'ImageObject',
			url: absoluteUrl('/icon-512-v2.png', origin)
		}
	};
}

export function buildWebSiteJsonLd(origin: string, description: string): JsonLd {
	const base = origin.replace(/\/$/, '');
	return {
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		name: SITE_NAME,
		url: `${base}/`,
		description,
		publisher: orgPublisher(origin),
		potentialAction: {
			'@type': 'SearchAction',
			target: `${base}/catalog/all?q={search_term_string}`,
			'query-input': 'required name=search_term_string'
		}
	};
}

export function buildArticleJsonLd(
	origin: string,
	article: Pick<Article, 'title' | 'excerpt' | 'slug'>,
	locale: AppLocale
): JsonLd {
	const pageUrl = absoluteUrl(`/articles/${encodeURIComponent(article.slug)}`, origin);
	return {
		'@context': 'https://schema.org',
		'@type': 'Article',
		headline: article.title,
		description: article.excerpt,
		inLanguage: locale,
		mainEntityOfPage: pageUrl,
		url: pageUrl,
		image: absoluteUrl(articleOgPath(article.slug, locale), origin),
		author: orgPublisher(origin),
		publisher: orgPublisher(origin)
	};
}

export function buildExerciseHowToJsonLd(
	origin: string,
	exercise: Exercise,
	locale: AppLocale,
	steps: string[]
): JsonLd {
	const name = exerciseName(exercise, locale);
	const pageUrl = absoluteUrl(`/exercise/${encodeURIComponent(exercise.id)}`, origin);
	const image = exercise.image
		? absoluteUrl(`/${exercise.image}`, origin)
		: exercise.gif_url
			? absoluteUrl(`/${exercise.gif_url}`, origin)
			: undefined;
	return {
		'@context': 'https://schema.org',
		'@type': 'HowTo',
		name,
		url: pageUrl,
		inLanguage: locale,
		...(image ? { image } : {}),
		step: steps.map((text, index) => ({
			'@type': 'HowToStep',
			position: index + 1,
			text
		}))
	};
}
