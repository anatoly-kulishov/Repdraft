export const SITE_NAME = 'Repdraft';

/** Public production host (apex redirects here). Used when env/request origin is unusable. */
export const CANONICAL_SITE_ORIGIN = 'https://www.repdraft.ru';

/**
 * Square brand mark used as `Organization.logo` (search logo + rich results).
 * `?v=` matches `FAVICON_CACHE_BUST` in scripts/generate-brand-icons.mjs: Google
 * caches the *image*, so a new query string is the only way to make it refetch.
 * Bump both together when the icon art changes.
 */
export const LOGO_IMAGE_PATH = '/icon-512-v3.png?v=16';

const DEFAULT_OG_IMAGE = '/og-image.jpg';
/** Square mark. Second og:image so Google can use it instead of cropping the wide card. */
export const OG_SQUARE_IMAGE_PATH = '/og-square.jpg';

/** SvelteKit placeholder host baked into prerender HTML when PUBLIC_SITE_URL is unset. */
const PRERENDER_PLACEHOLDER_HOST = 'sveltekit-prerender';

/** Trim and cap length for meta description tags. */
export function truncateMeta(text: string, max = 160): string {
	const trimmed = text.replace(/\s+/g, ' ').trim();
	if (!trimmed) return '';
	if (trimmed.length <= max) return trimmed;
	return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

export function formatSeoTitle(pageTitle: string): string {
	const trimmed = pageTitle.trim();
	if (!trimmed || trimmed === SITE_NAME) return SITE_NAME;
	if (trimmed.startsWith(`${SITE_NAME} `) || trimmed.startsWith(`${SITE_NAME}·`)) {
		return trimmed;
	}
	return `${trimmed} · ${SITE_NAME}`;
}

/** True when origin is safe for canonical / sitemap / og:url (rejects prerender placeholder). */
export function isUsableSiteOrigin(origin: string): boolean {
	const trimmed = origin.trim().replace(/\/$/, '');
	if (!trimmed) return false;
	let parsed: URL;
	try {
		parsed = new URL(trimmed);
	} catch {
		return false;
	}
	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
	if (parsed.hostname.toLowerCase() === PRERENDER_PLACEHOLDER_HOST) return false;
	return true;
}

/** True for production image/CI builds. */
function isProductionBuild(): boolean {
	return process.env.NODE_ENV === 'production';
}

/** Configured canonical origin, or empty when unset / unusable. */
export function configuredSiteOrigin(): string {
	const raw =
		typeof import.meta.env?.PUBLIC_SITE_URL === 'string'
			? import.meta.env.PUBLIC_SITE_URL.trim()
			: '';
	if (!raw) return '';
	const origin = raw.replace(/\/$/, '');
	return isUsableSiteOrigin(origin) ? origin : '';
}

/**
 * Absolute origin: env override, else usable request origin.
 * On production prerender (placeholder / empty), falls back to CANONICAL_SITE_ORIGIN.
 */
export function resolveSiteOrigin(requestOrigin = ''): string {
	const configured = configuredSiteOrigin();
	if (configured) return configured;
	const cleaned = requestOrigin.trim().replace(/\/$/, '');
	if (isUsableSiteOrigin(cleaned)) return cleaned;
	if (isProductionBuild()) return CANONICAL_SITE_ORIGIN;
	return '';
}

export function absoluteUrl(path: string, requestOrigin = ''): string {
	const origin = resolveSiteOrigin(requestOrigin);
	const normalizedPath = path.startsWith('/') ? path : `/${path}`;
	if (!origin) return normalizedPath;
	return `${origin}${normalizedPath}`;
}

export function defaultOgImage(requestOrigin = ''): string {
	return absoluteUrl(DEFAULT_OG_IMAGE, requestOrigin);
}

export function squareOgImage(requestOrigin = ''): string {
	return absoluteUrl(OG_SQUARE_IMAGE_PATH, requestOrigin);
}
