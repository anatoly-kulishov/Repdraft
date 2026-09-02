import type { AppLocale } from './locale';
import { translate } from './messages';

/** Human label for mobile/desktop back crumb from a resolved href. */
export function backLabelForHref(href: string, lang: AppLocale): string {
	const path = href.split('?')[0] ?? href;

	if (path.startsWith('/workouts')) return translate(lang, 'builder.backWorkouts');
	if (path === '/exercises/records' || path === '/records') return translate(lang, 'records.title');
	if (path === '/articles') return translate(lang, 'articles.title');
	if (path.startsWith('/articles/')) return translate(lang, 'articles.backHub');
	if (path.startsWith('/catalog/')) return translate(lang, 'catalog.hubTitle');
	if (path === '/exercises/saved') return translate(lang, 'bookmarks.title');
	if (path.startsWith('/builder')) return translate(lang, 'builder.title');
	if (path.startsWith('/exercise/')) return translate(lang, 'a11y.back');
	if (path === '/exercises') return translate(lang, 'catalog.hubTitle');

	return translate(lang, 'a11y.back');
}
