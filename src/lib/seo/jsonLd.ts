import type { AppLocale } from '$lib/i18n/locale';
import type { Article } from '$lib/domain/articles';
import type { Exercise } from '$lib/domain/types';
import { exerciseName } from '$lib/domain/exerciseName';
import { LOGO_IMAGE_PATH, OG_SQUARE_IMAGE_PATH, SITE_NAME, absoluteUrl } from '$lib/seo/site';
import { articleOgPath } from '$lib/seo/articleOg';

type JsonLd = Record<string, unknown>;

function orgId(origin: string): string {
	return `${origin.replace(/\/$/, '')}/#organization`;
}

function orgPublisher(origin: string): JsonLd {
	return {
		'@type': 'Organization',
		'@id': orgId(origin),
		name: SITE_NAME,
		url: origin,
		logo: logoObject(origin)
	};
}

/** Google wants a sized square image (≥112×112) — a bare `url` is often ignored. */
function logoObject(origin: string): JsonLd {
	return {
		'@type': 'ImageObject',
		url: absoluteUrl(LOGO_IMAGE_PATH, origin),
		width: 512,
		height: 512,
		caption: SITE_NAME
	};
}

/**
 * Standalone Organization node for the home page. The search logo is picked from
 * here (not from a nested `publisher`), so keep it a top-level graph node.
 */
export function buildOrganizationJsonLd(origin: string): JsonLd {
	return {
		'@context': 'https://schema.org',
		'@type': 'Organization',
		'@id': orgId(origin),
		name: SITE_NAME,
		url: origin.replace(/\/$/, ''),
		logo: logoObject(origin)
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

/*
 * App identity for rich results / AI answers (Яндекс, Google, Алиса).
 * Free offer — do not invent a price.
 */
export function buildWebApplicationJsonLd(origin: string, description: string): JsonLd {
	const base = origin.replace(/\/$/, '');
	return {
		'@context': 'https://schema.org',
		'@type': 'WebApplication',
		name: SITE_NAME,
		url: `${base}/`,
		description,
		applicationCategory: 'HealthApplication',
		operatingSystem: 'Any (web browser)',
		browserRequirements: 'Requires JavaScript',
		isAccessibleForFree: true,
		inLanguage: ['ru', 'en'],
		image: absoluteUrl(OG_SQUARE_IMAGE_PATH, origin),
		icon: absoluteUrl(LOGO_IMAGE_PATH, origin),
		offers: {
			'@type': 'Offer',
			price: '0',
			priceCurrency: 'RUB'
		},
		publisher: orgPublisher(origin)
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
	steps: string[],
	/** Canonical path of this page (`/en/exercise/:id` on a mirror). */
	path?: string
): JsonLd {
	const name = exerciseName(exercise, locale);
	const pageUrl = absoluteUrl(
		path ?? `/exercise/${encodeURIComponent(exercise.id)}`,
		origin
	);
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

/**
 * Program identity: a free structured course built from the exercise catalog.
 * `Course` is the schema Google/Yandex understand for "4-week plan" content.
 */
export function buildProgramJsonLd(
	origin: string,
	program: { path: string; title: string; description: string; locale: AppLocale; weeks: number }
): JsonLd {
	const pageUrl = absoluteUrl(program.path, origin);
	return {
		'@context': 'https://schema.org',
		'@type': 'Course',
		name: program.title,
		description: program.description,
		url: pageUrl,
		inLanguage: program.locale,
		isAccessibleForFree: true,
		provider: orgPublisher(origin),
		offers: {
			'@type': 'Offer',
			price: '0',
			priceCurrency: 'RUB'
		},
		hasCourseInstance: {
			'@type': 'CourseInstance',
			courseMode: 'online',
			courseWorkload: `PT${program.weeks}W`
		}
	};
}

/**
 * Breadcrumbs for content pages (catalog, tools, exercises). Search engines use
 * them instead of guessing hierarchy from URLs; they also feed the SERP trail.
 */
export function buildBreadcrumbJsonLd(
	origin: string,
	items: { name: string; path: string }[]
): JsonLd {
	const base = origin.replace(/\/$/, '');
	return {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: items.map((item, index) => ({
			'@type': 'ListItem',
			position: index + 1,
			name: item.name,
			item: `${base}${item.path}`
		}))
	};
}

/**
 * Calculator identity: a free browser app, not a service with a price. Same
 * shape as `buildWebApplicationJsonLd` but scoped to one tool page.
 */
export function buildToolJsonLd(
	origin: string,
	tool: { path: string; title: string; description: string; locale: AppLocale }
): JsonLd {
	const pageUrl = absoluteUrl(tool.path, origin);
	return {
		'@context': 'https://schema.org',
		'@type': 'WebApplication',
		name: tool.title,
		url: pageUrl,
		description: tool.description,
		applicationCategory: 'HealthApplication',
		operatingSystem: 'Any (web browser)',
		browserRequirements: 'Requires JavaScript',
		isAccessibleForFree: true,
		inLanguage: tool.locale,
		mainEntityOfPage: pageUrl,
		offers: {
			'@type': 'Offer',
			price: '0',
			priceCurrency: 'RUB'
		},
		publisher: orgPublisher(origin)
	};
}
