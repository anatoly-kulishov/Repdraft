export const SITE_NAME = 'Repdraft';

const DEFAULT_OG_IMAGE = '/icon-512-v2.png';

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
	return `${trimmed} · ${SITE_NAME}`;
}

/** Configured canonical origin, or empty when unset. */
export function configuredSiteOrigin(): string {
	const raw = import.meta.env.PUBLIC_SITE_URL?.trim();
	if (!raw) return '';
	return raw.replace(/\/$/, '');
}

/** Absolute origin: env override, else current request origin when available. */
export function resolveSiteOrigin(requestOrigin = ''): string {
	return configuredSiteOrigin() || requestOrigin.replace(/\/$/, '');
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
