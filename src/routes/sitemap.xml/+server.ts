import { buildSitemapXml, collectSitemapEntries } from '$lib/seo/sitemap';
import { resolveSiteOrigin } from '$lib/seo/site';
import type { RequestHandler } from './$types';

/** SSR so <loc> uses the live request origin (never sveltekit-prerender). */
export const prerender = false;

export const GET: RequestHandler = async ({ url }) => {
	const origin = resolveSiteOrigin(url.origin);
	if (!origin) {
		return new Response('Sitemap unavailable: set PUBLIC_SITE_URL', { status: 503 });
	}

	const entries = await collectSitemapEntries();
	const xml = buildSitemapXml(origin, entries);

	return new Response(xml, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
