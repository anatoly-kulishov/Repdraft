import { buildSitemapXml, collectSitemapEntries } from '$lib/seo/sitemap';
import { PRERENDER_PUBLIC } from '$lib/seo/prerenderPublic';
import { configuredSiteOrigin } from '$lib/seo/site';
import type { RequestHandler } from './$types';

export const prerender = PRERENDER_PUBLIC;

export const GET: RequestHandler = async ({ url }) => {
	const origin = configuredSiteOrigin() || url.origin;
	if (!origin) {
		return new Response('Sitemap unavailable', { status: 404 });
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
