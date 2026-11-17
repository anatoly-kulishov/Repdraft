import type { Handle } from '@sveltejs/kit';
import { CANONICAL_SITE_ORIGIN } from '$lib/seo/site';

/** Apex of the public site. Vercel “Redirect to www” must be OFF for this to run. */
const CANONICAL_APEX = 'repdraft.ru';

/**
 * Previous zone. Its apex still lands on www of the same zone so shipped
 * app builds and old links keep working until that host is retired.
 */
const LEGACY_APEX = 'repdraft.xyz';
const LEGACY_ORIGIN = 'https://www.repdraft.xyz';

/**
 * Paths that must return 200 on apex without a 308 (Yandex favicon probe).
 * Keep in sync with static search icons / SEO files.
 */
const APEX_PASSTHROUGH =
	/^\/(favicon\.ico|favicon-\d+x\d+\.png|apple-touch-icon(?:-precomposed)?-v3\.png|robots\.txt|sitemap\.xml)$/i;

/**
 * App-level apex → www redirect with favicon/SEO passthrough.
 * If Domains → “Redirect to www” is still enabled in Vercel, the edge redirect
 * wins and this hook never sees apex traffic. Turn that toggle off after deploy.
 */
export const handle: Handle = async ({ event, resolve }) => {
	const host = event.url.hostname.toLowerCase();
	const apexOrigin =
		host === CANONICAL_APEX ? CANONICAL_SITE_ORIGIN : host === LEGACY_APEX ? LEGACY_ORIGIN : '';
	if (apexOrigin && !APEX_PASSTHROUGH.test(event.url.pathname)) {
		const dest = new URL(`${event.url.pathname}${event.url.search}`, apexOrigin);
		return Response.redirect(dest, 308);
	}
	return resolve(event);
};
