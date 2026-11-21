/**
 * Language URL scheme.
 *
 * Russian stays on the bare path (`/tools/bmi`) — it is the canonical origin and
 * the whole `.ru` cutover (301 map, Yandex) points there. English lives under
 * `/en/...` with a self-canonical, so both versions are indexable and the pair
 * is declared with `hreflang`. No cookie-based language switching for crawlers:
 * Googlebot sends no useful Accept-Language.
 */

export const EN_PREFIX = '/en';

export type HreflangAlternate = { lang: string; path: string };

export function enPath(path: string): string {
	return path === '/' ? EN_PREFIX : `${EN_PREFIX}${path}`;
}

export function isEnglishPath(pathname: string): boolean {
	return pathname === EN_PREFIX || pathname.startsWith(`${EN_PREFIX}/`);
}

/** Inverse of `enPath`: back to the canonical Russian path. */
export function ruPath(path: string): string {
	if (path === EN_PREFIX) return '/';
	if (path.startsWith(`${EN_PREFIX}/`)) return path.slice(EN_PREFIX.length);
	return path;
}

/** `hreflang` cluster for a page that exists in both languages. */
export function ruEnAlternates(path: string): HreflangAlternate[] {
	return [
		{ lang: 'ru', path },
		{ lang: 'en', path: enPath(path) },
		{ lang: 'x-default', path }
	];
}

export function runAlternatesSelfCheck(): void {
	if (enPath('/tools') !== '/en/tools') throw new Error('alternates: enPath page');
	if (enPath('/') !== '/en') throw new Error('alternates: enPath root');
	if (!isEnglishPath('/en')) throw new Error('alternates: isEnglishPath root');
	if (!isEnglishPath('/en/tools')) throw new Error('alternates: isEnglishPath nested');
	if (isEnglishPath('/environment')) throw new Error('alternates: isEnglishPath prefix leak');
	if (ruPath('/en') !== '/') throw new Error('alternates: ruPath root');
	if (ruPath('/en/tools/bmi') !== '/tools/bmi') throw new Error('alternates: ruPath nested');
	if (ruPath('/tools') !== '/tools') throw new Error('alternates: ruPath passthrough');

	const cluster = ruEnAlternates('/bmi');
	if (cluster.map((row) => row.lang).join() !== 'ru,en,x-default') {
		throw new Error('alternates: cluster order');
	}
	if (cluster[1].path !== '/en/bmi') throw new Error('alternates: cluster en path');
	if (cluster[2].path !== '/bmi') throw new Error('alternates: x-default is ru');
}
