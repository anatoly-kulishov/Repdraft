import type { AppLocale } from '$lib/i18n/locale';
import type { Article } from '$lib/domain/articles';
import { SITE_NAME } from '$lib/seo/site';

const TONE_PALETTE: Record<
	NonNullable<Article['coverTone']>,
	{ bg: string; accent: string; text: string }
> = {
	teal: { bg: '#ecfdf5', accent: '#0d9488', text: '#134e4a' },
	lime: { bg: '#f5f3ff', accent: '#8b5cf6', text: '#4c1d95' },
	purple: { bg: '#f5f3ff', accent: '#8b5cf6', text: '#4c1d95' },
	amber: { bg: '#fffbeb', accent: '#d97706', text: '#92400e' },
	rose: { bg: '#fff1f2', accent: '#e11d48', text: '#9f1239' }
};

function escapeXml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

function wrapLines(text: string, maxChars: number, maxLines: number): string[] {
	const words = text.replace(/\s+/g, ' ').trim().split(' ');
	const lines: string[] = [];
	let current = '';
	for (const word of words) {
		const next = current ? `${current} ${word}` : word;
		if (next.length <= maxChars) {
			current = next;
			continue;
		}
		if (current) lines.push(current);
		current = word;
		if (lines.length >= maxLines) break;
	}
	if (current && lines.length < maxLines) lines.push(current);
	return lines.slice(0, maxLines);
}

export const ARTICLE_OG_WIDTH = 1200;
export const ARTICLE_OG_HEIGHT = 630;

export function articleOgPath(slug: string, locale?: AppLocale): string {
	const base = `/og/article/${encodeURIComponent(slug)}`;
	return locale ? `${base}?locale=${locale}` : base;
}

export function buildArticleOgSvg(article: Pick<Article, 'title' | 'excerpt' | 'coverTone'>): string {
	const tone = TONE_PALETTE[article.coverTone ?? 'lime'] ?? TONE_PALETTE.lime;
	const titleLines = wrapLines(article.title, 28, 2);
	const excerptLines = wrapLines(article.excerpt, 42, 2);
	const titleY = titleLines.length > 1 ? 250 : 270;
	const excerptY = 360;

	const titleSvg = titleLines
		.map(
			(line, index) =>
				`<tspan x="80" dy="${index === 0 ? 0 : 52}">${escapeXml(line)}</tspan>`
		)
		.join('');
	const excerptSvg = excerptLines
		.map(
			(line, index) =>
				`<tspan x="80" dy="${index === 0 ? 0 : 36}">${escapeXml(line)}</tspan>`
		)
		.join('');

	return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${ARTICLE_OG_WIDTH}" height="${ARTICLE_OG_HEIGHT}" viewBox="0 0 ${ARTICLE_OG_WIDTH} ${ARTICLE_OG_HEIGHT}" role="img">
  <rect width="100%" height="100%" fill="${tone.bg}"/>
  <rect x="0" y="0" width="100%" height="10" fill="${tone.accent}"/>
  <text x="80" y="120" fill="${tone.accent}" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="28" font-weight="700" letter-spacing="0.08em">${SITE_NAME.toUpperCase()}</text>
  <text x="80" y="${titleY}" fill="${tone.text}" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="52" font-weight="700">${titleSvg}</text>
  <text x="80" y="${excerptY}" fill="${tone.text}" opacity="0.82" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="30" font-weight="400">${excerptSvg}</text>
</svg>`;
}
