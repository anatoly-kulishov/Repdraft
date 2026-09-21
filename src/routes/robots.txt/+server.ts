import { resolveSiteOrigin } from '$lib/seo/site';
import type { RequestHandler } from './$types';

/** SSR so Sitemap uses the live request origin (never sveltekit-prerender). */
export const prerender = false;

/** App-only routes: meta noindex plus robots Disallow belt-and-suspenders. */
const ROBOTS_DISALLOW = [
	'/auth',
	'/builder',
	'/live/',
	'/workouts/',
	'/exercises/records',
	'/exercises/saved',
	'/scenarios'
] as const;

export const GET: RequestHandler = async ({ url }) => {
	const origin = resolveSiteOrigin(url.origin);
	const lines = ['User-agent: *', ...ROBOTS_DISALLOW.map((path) => `Disallow: ${path}`)];

	if (origin) {
		lines.push('', `Sitemap: ${origin}/sitemap.xml`);
	}

	return new Response(`${lines.join('\n')}\n`, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
