import type { AppLocale } from '../i18n/locale';

export type ArticleCoverIcon =
	| 'book-open'
	| 'timer'
	| 'dumbbell'
	| 'play'
	| 'clipboard-list'
	| 'library'
	| 'flame'
	| 'history'
	| 'sparkles'
	| 'users'
	| 'chart'
	| 'upload';

export type Article = {
	slug: string;
	title: string;
	excerpt: string;
	/** CSS gradient token, e.g. `lime`, `teal`. Legacy `purple` = lime. */
	coverTone?: 'lime' | 'purple' | 'teal' | 'amber' | 'rose';
	/** Lucide cover when `exerciseIds` is empty. */
	coverIcon?: ArticleCoverIcon;
	bodyMd: string;
	tags: string[];
	exerciseIds: string[];
	locale: AppLocale;
	/** Primary CTA target. */
	ctaHref?: string;
	ctaLabelKey?: string;
};

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

const ORDERED_ITEM = /^(\d+)\.\s+(.*)$/;
const IMAGE_LINE = /^!\[([^\]]*)\]\(([^)\s]+)\)$/;

/** Default (RU) article screenshots. EN lives under `…/en/` when present. */
export const ARTICLE_IMAGES_PREFIX = '/images/articles/';
export const ARTICLE_IMAGES_EN_PREFIX = '/images/articles/en/';

export type RenderArticleBodyOptions = {
	locale?: AppLocale;
	/**
	 * Basenames available under `/images/articles/en/` (web inventory).
	 * Without this set EN articles keep the RU screenshot paths (no 404).
	 */
	enScreenshots?: ReadonlySet<string>;
};

/**
 * Locale-aware screenshot path. Theme is intentionally ignored: one dark
 * canonical shot per locale. RN can keep calling without options.
 */
export function resolveArticleImageSrc(
	src: string,
	locale: AppLocale = 'ru',
	enScreenshots?: ReadonlySet<string>
): string {
	if (locale !== 'en') return src;
	if (!enScreenshots || enScreenshots.size === 0) return src;
	if (!src.startsWith(ARTICLE_IMAGES_PREFIX) || src.startsWith(ARTICLE_IMAGES_EN_PREFIX)) {
		return src;
	}
	const file = src.slice(ARTICLE_IMAGES_PREFIX.length);
	if (!file || file.includes('/')) return src;
	if (!enScreenshots.has(file)) return src;
	return `${ARTICLE_IMAGES_EN_PREFIX}${file}`;
}

/** ponytail: minimal markdown - headings, ul/ol, images, paragraphs, links only. */
export function renderArticleBody(
	markdown: string,
	options: RenderArticleBodyOptions = {}
): string {
	const locale = options.locale ?? 'ru';
	const enScreenshots = options.enScreenshots;
	const lines = markdown.replace(/\r\n/g, '\n').split('\n');
	const out: string[] = [];
	let listTag: 'ul' | 'ol' | null = null;

	const closeList = () => {
		if (listTag) {
			out.push(`</${listTag}>`);
			listTag = null;
		}
	};

	const openList = (tag: 'ul' | 'ol') => {
		if (listTag !== tag) {
			closeList();
			out.push(`<${tag}>`);
			listTag = tag;
		}
	};

	for (const raw of lines) {
		const line = raw.trimEnd();
		if (!line.trim()) {
			closeList();
			continue;
		}
		if (line.startsWith('## ')) {
			closeList();
			out.push(`<h2>${inlineMarkdown(line.slice(3))}</h2>`);
			continue;
		}
		const image = IMAGE_LINE.exec(line.trim());
		if (image) {
			closeList();
			const alt = escapeHtml(image[1] ?? '');
			const rawSrc = image[2] ?? '';
			const src = escapeHtml(resolveArticleImageSrc(rawSrc, locale, enScreenshots));
			out.push(
				`<img class="article-body__img" src="${src}" alt="${alt}" loading="lazy" decoding="async">`
			);
			continue;
		}
		if (line.startsWith('- ')) {
			openList('ul');
			out.push(`<li>${inlineMarkdown(line.slice(2))}</li>`);
			continue;
		}
		const ordered = ORDERED_ITEM.exec(line);
		if (ordered) {
			openList('ol');
			out.push(`<li>${inlineMarkdown(ordered[2] ?? '')}</li>`);
			continue;
		}
		closeList();
		out.push(`<p>${inlineMarkdown(line)}</p>`);
	}
	closeList();
	return out.join('');
}

function inlineMarkdown(text: string): string {
	let out = escapeHtml(text);
	out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, href) => {
		const safeHref = String(href).replace(/"/g, '&quot;');
		return `<a href="${safeHref}">${label}</a>`;
	});
	out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
	return out;
}

export function articlesForExercise(
	articles: Article[],
	exerciseId: string,
	locale?: AppLocale
): Article[] {
	return articles.filter(
		(a) => a.exerciseIds.includes(exerciseId) && (locale == null || a.locale === locale)
	);
}

export function articleCoverExerciseId(article: Article): string | null {
	return article.exerciseIds[0] ?? null;
}

const SLUG_COVER_ICONS: Partial<Record<string, ArticleCoverIcon>> = {
	'warmup-before-press': 'flame',
	'read-workout-plan': 'book-open',
	'rest-between-sets': 'timer',
	'technique-clips': 'library',
	'legs-split': 'dumbbell',
	'first-session': 'history',
	'getting-started-quick-demo': 'play',
	'ai-workout-draft': 'sparkles',
	'coach-mode': 'users',
	'ai-coach-hints': 'sparkles',
	'progress-overview': 'chart',
	'import-history': 'upload'
};

export function resolveArticleCoverIcon(article: Article): ArticleCoverIcon {
	if (article.coverIcon) return article.coverIcon;
	return SLUG_COVER_ICONS[article.slug] ?? 'book-open';
}

export function filterArticles(
	articles: Article[],
	query: string,
	locale: AppLocale = 'ru'
): Article[] {
	const q = query.trim().toLowerCase();
	const forLocale = articles.filter((a) => a.locale === locale);
	// Fallback keeps Guide usable if a locale pack is missing or still loading.
	const pool = forLocale.length > 0 ? forLocale : articles.filter((a) => a.locale === 'ru');
	const filtered = !q
		? pool
		: pool.filter(
				(a) =>
					a.title.toLowerCase().includes(q) ||
					a.excerpt.toLowerCase().includes(q) ||
					a.tags.some((t) => t.toLowerCase().includes(q))
			);
	return sortArticlesForHub(filtered);
}

/** Pinned «getting-started» articles first in the hub grid. */
export function sortArticlesForHub(articles: Article[]): Article[] {
	return [...articles].sort((a, b) => {
		const aStart = a.tags.includes('getting-started') ? 0 : 1;
		const bStart = b.tags.includes('getting-started') ? 0 : 1;
		if (aStart !== bStart) return aStart - bStart;
		return a.title.localeCompare(b.title, 'ru');
	});
}

export function runArticlesSelfCheck(): void {
	const html = renderArticleBody(
		'## Title\n\nHello **world**.\n\n- one\n- two\n\n1. first\n2. second\n\n![Форма](/images/articles/ai-draft-form.jpg)'
	);
	if (!html.includes('<h2>Title</h2>') || !html.includes('<strong>world</strong>')) {
		throw new Error('renderArticleBody failed');
	}
	if (!html.includes('<ul><li>one</li><li>two</li></ul>')) {
		throw new Error('renderArticleBody ul failed');
	}
	if (!html.includes('<ol><li>first</li><li>second</li></ol>')) {
		throw new Error('renderArticleBody ol failed');
	}
	if (
		!html.includes(
			'<img class="article-body__img" src="/images/articles/ai-draft-form.jpg" alt="Форма" loading="lazy" decoding="async">'
		)
	) {
		throw new Error('renderArticleBody image failed');
	}
	const enHtml = renderArticleBody(
		'![Form](/images/articles/ai-draft-form.jpg)',
		{ locale: 'en', enScreenshots: new Set(['ai-draft-form.jpg']) }
	);
	if (!enHtml.includes('src="/images/articles/en/ai-draft-form.jpg"')) {
		throw new Error('renderArticleBody en screenshot rewrite failed');
	}
	const enFallback = renderArticleBody('![Form](/images/articles/ai-draft-form.jpg)', {
		locale: 'en',
		enScreenshots: new Set()
	});
	if (!enFallback.includes('src="/images/articles/ai-draft-form.jpg"')) {
		throw new Error('renderArticleBody en screenshot fallback failed');
	}
	const articles: Article[] = [
		{
			slug: 'a',
			title: 'A',
			excerpt: 'x',
			bodyMd: '',
			tags: [],
			exerciseIds: ['1'],
			locale: 'ru'
		}
	];
	if (articlesForExercise(articles, '1').length !== 1) throw new Error('articlesForExercise failed');
	if (articlesForExercise(articles, '1', 'en').length !== 0) {
		throw new Error('articlesForExercise locale filter failed');
	}
	const withEn: Article[] = [
		...articles,
		{ ...articles[0]!, title: 'A-en', locale: 'en' }
	];
	if (filterArticles(withEn, '', 'en').length !== 1) {
		throw new Error('filterArticles should return en only');
	}
	if (filterArticles(withEn, '', 'ru').length !== 1) {
		throw new Error('filterArticles should return ru only');
	}
	if (filterArticles(articles, '', 'en').length !== 1) {
		throw new Error('filterArticles should fall back to ru when en missing');
	}
	if (resolveArticleCoverIcon(articles[0]) !== 'book-open') {
		throw new Error('resolveArticleCoverIcon failed');
	}
	if (articleCoverExerciseId(articles[0]) !== '1') throw new Error('articleCoverExerciseId failed');
}
