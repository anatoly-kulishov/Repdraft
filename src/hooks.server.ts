import type { Handle } from '@sveltejs/kit';
import { CANONICAL_SITE_ORIGIN } from '$lib/seo/site';

/** Apex of the public site (Caddy may also redirect apex → www). */
const CANONICAL_APEX = 'repdraft.ru';

/** Previous zone: every host redirects to www.repdraft.ru. */
const LEGACY_HOSTS = new Set(['repdraft.xyz', 'www.repdraft.xyz']);

/**
 * Paths that must return 200 on apex without a 308 (Yandex favicon probe).
 * Keep in sync with static search icons / SEO files.
 */
const APEX_PASSTHROUGH =
	/^\/(favicon\.ico|favicon-\d+x\d+\.png|apple-touch-icon(?:-precomposed)?-v3\.png|robots\.txt|sitemap\.xml|yandex_[a-f0-9]+\.html)$/i;

/** Path + query for redirects. `url.search` throws during prerender. */
function redirectTarget(url: URL, origin: string): URL {
	let search = '';
	try {
		search = url.search;
	} catch {
		search = '';
	}
	return new URL(`${url.pathname}${search}`, origin);
}

/**
 * Apex → www for the public domain, plus full cutover of the legacy zone.
 */
export const handle: Handle = async ({ event, resolve }) => {
	const host = event.url.hostname.toLowerCase();
	const redirectLegacy = LEGACY_HOSTS.has(host);
	const redirectApex =
		host === CANONICAL_APEX && !APEX_PASSTHROUGH.test(event.url.pathname);

	if (redirectLegacy || redirectApex) {
		return Response.redirect(redirectTarget(event.url, CANONICAL_SITE_ORIGIN), 308);
	}

	return resolve(event);
};
