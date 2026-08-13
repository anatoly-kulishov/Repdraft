import type { AppLocale } from '$lib/i18n/locale';

export type ArticleCoverIcon =
	| 'book-open'
	| 'timer'
	| 'dumbbell'
	| 'play'
	| 'clipboard-list'
	| 'library'
	| 'flame';

export type Article = {
	slug: string;
	title: string;
	excerpt: string;
	/** CSS gradient token, e.g. `purple`, `teal`. */
	coverTone?: 'purple' | 'teal' | 'amber' | 'rose';
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

/** ponytail: minimal markdown — headings, lists, paragraphs, links only. */
export function renderArticleBody(markdown: string): string {
	const lines = markdown.replace(/\r\n/g, '\n').split('\n');
	const out: string[] = [];
	let inList = false;

	const closeList = () => {
		if (inList) {
			out.push('</ul>');
			inList = false;
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
		if (line.startsWith('- ')) {
			if (!inList) {
				out.push('<ul>');
				inList = true;
			}
			out.push(`<li>${inlineMarkdown(line.slice(2))}</li>`);
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

export function articlesForExercise(articles: Article[], exerciseId: string): Article[] {
	return articles.filter((a) => a.exerciseIds.includes(exerciseId));
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
	'first-session': 'play'
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
	if (!q) return articles.filter((a) => a.locale === locale);
	return articles.filter(
		(a) =>
			a.locale === locale &&
			(a.title.toLowerCase().includes(q) ||
				a.excerpt.toLowerCase().includes(q) ||
				a.tags.some((t) => t.toLowerCase().includes(q)))
	);
}

export function runArticlesSelfCheck(): void {
	const html = renderArticleBody('## Title\n\nHello **world**.\n\n- one\n- two');
	if (!html.includes('<h2>Title</h2>') || !html.includes('<strong>world</strong>')) {
		throw new Error('renderArticleBody failed');
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
	if (resolveArticleCoverIcon(articles[0]) !== 'book-open') {
		throw new Error('resolveArticleCoverIcon failed');
	}
	if (articleCoverExerciseId(articles[0]) !== '1') throw new Error('articleCoverExerciseId failed');
}
