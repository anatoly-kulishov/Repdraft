import type { Handle } from '@sveltejs/kit';
import { CANONICAL_SITE_ORIGIN } from '$lib/seo/site';

/** Apex host Yandex indexes; Vercel “Redirect to www” must be OFF for this to run. */
const APEX_HOST = 'repdraft.xyz';

/**
 * Paths that must return 200 on apex without a 308 (Yandex favicon probe).
 * Keep in sync with static search icons / SEO files.
 */
const APEX_PASSTHROUGH =
	/^\/(favicon\.ico|favicon-\d+x\d+\.png|apple-touch-icon(?:-precomposed)?-v3\.png|robots\.txt|sitemap\.xml)$/i;

/**
 * App-level apex → www redirect with favicon/SEO passthrough.
 * If Domains → “Redirect to www” is still enabled in Vercel, the edge redirect
 * wins and this hook never sees apex traffic — turn that toggle off after deploy.
 */
export const handle: Handle = async ({ event, resolve }) => {
	const host = event.url.hostname.toLowerCase();
	if (host === APEX_HOST && !APEX_PASSTHROUGH.test(event.url.pathname)) {
		const dest = new URL(`${event.url.pathname}${event.url.search}`, CANONICAL_SITE_ORIGIN);
		return Response.redirect(dest, 308);
	}
	return resolve(event);
};
