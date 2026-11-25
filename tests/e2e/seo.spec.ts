import { expect, test } from '@playwright/test';
import { SITE } from '../helpers/app';

const PAIRS: { ru: string; en: string }[] = [
	{ ru: '/tools/calories', en: '/en/tools/calories' },
	{ ru: '/programs/full-body-3x', en: '/en/programs/full-body-3x' },
	{ ru: '/exercise/0001', en: '/en/exercise/0001' }
];

function htmlLang(html: string): string | null {
	return html.match(/<html[^>]*\blang="([^"]+)"/i)?.[1] ?? null;
}

function canonical(html: string): string | null {
	return html.match(/rel="canonical"\s+href="([^"]+)"/i)?.[1] ?? null;
}

function hreflangMap(html: string): Record<string, string> {
	const map: Record<string, string> = {};
	for (const match of html.matchAll(/hreflang="([^"]+)"\s+href="([^"]+)"/gi)) {
		map[match[1]] = match[2];
	}
	return map;
}

function ogLocale(html: string): string | null {
	return html.match(/property="og:locale"\s+content="([^"]+)"/i)?.[1] ?? null;
}

test.describe('crawlable URL contract', () => {
	for (const { ru, en } of PAIRS) {
		test(`RU/EN pair ${ru}`, async ({ request }) => {
			const ruResponse = await request.get(ru);
			const enResponse = await request.get(en);
			expect(ruResponse.status(), `${ru} status`).toBe(200);
			expect(enResponse.status(), `${en} status`).toBe(200);

			const ruHtml = await ruResponse.text();
			const enHtml = await enResponse.text();

			expect(htmlLang(ruHtml)).toBe('ru');
			expect(htmlLang(enHtml)).toBe('en');

			expect(canonical(ruHtml), `${ru} canonical`).toBe(`${SITE}${ru}`);
			expect(canonical(enHtml), `${en} canonical`).toBe(`${SITE}${en}`);

			const ruAlts = hreflangMap(ruHtml);
			const enAlts = hreflangMap(enHtml);
			const expected = { ru: `${SITE}${ru}`, en: `${SITE}${en}`, 'x-default': `${SITE}${ru}` };
			expect(ruAlts).toEqual(expected);
			expect(enAlts).toEqual(expected);

			expect(ogLocale(ruHtml)).toBe('ru_RU');
			expect(ogLocale(enHtml)).toBe('en_US');
		});
	}

	test('unknown program and exercise ids are real 404s', async ({ request }) => {
		for (const path of ['/programs/nope', '/en/programs/nope', '/exercise/nope', '/en/exercise/nope']) {
			const response = await request.get(path);
			expect(response.status(), `${path} status`).toBe(404);
			const html = await response.text();
			expect(html, `${path} robots`).toContain('noindex');
		}
	});

	test('robots.txt points to the sitemap', async ({ request }) => {
		const response = await request.get('/robots.txt');
		expect(response.status()).toBe(200);
		const body = await response.text();
		expect(body).toMatch(/Sitemap:\s*https:\/\/www\.repdraft\.ru\/sitemap\.xml/i);
	});

	/*
	 * Google renders the search logo from the biggest icon it can find and
	 * upscales whatever it picked. `sizes="any"` on the ICO made it pick the
	 * 16/32px frame → blurry tile, so this guards the fix.
	 */
	test('search icons are PNGs at Google-friendly sizes and the logo is sized', async ({
		request
	}) => {
		const response = await request.get('/');
		expect(response.status()).toBe(200);
		const html = await response.text();

		const iconLinks = [...html.matchAll(/<link[^>]*rel="(?:icon|shortcut icon)"[^>]*>/gi)].map(
			(match) => match[0]
		);
		const iconHrefs = iconLinks.map((tag) => tag.match(/href="([^"]+)"/)?.[1] ?? '');
		expect(iconHrefs.some((href) => /favicon-96x96\.png\?v=\d+/.test(href))).toBe(true);
		expect(iconHrefs.some((href) => /favicon-144x144\.png\?v=\d+/.test(href))).toBe(true);
		expect(iconHrefs.some((href) => /icon-192-v3\.png\?v=\d+/.test(href))).toBe(true);
		// A 16/32/48 ICO must not claim to be scalable.
		expect(iconLinks.some((tag) => /sizes="any"/.test(tag))).toBe(false);

		for (const href of iconHrefs.filter((href) => href.endsWith('.png') || href.includes('.png?'))) {
			const iconResponse = await request.get(href);
			expect(iconResponse.status(), `${href} status`).toBe(200);
			expect(iconResponse.headers()['content-type'], `${href} type`).toContain('image/png');
		}

		const jsonLd = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(
			(match) => match[1]
		);
		const organization = jsonLd
			.map((payload) => JSON.parse(payload) as Record<string, unknown>)
			.find((node) => node['@type'] === 'Organization');
		expect(organization).toBeTruthy();
		const logo = organization?.logo as Record<string, unknown> | undefined;
		expect(logo?.width).toBe(512);
		expect(logo?.height).toBe(512);
		expect(String(logo?.url)).toMatch(/icon-512-v3\.png\?v=\d+$/);
	});

	test('sitemap has no duplicate URLs and the sampled pages resolve', async ({ request }) => {
		const response = await request.get('/sitemap.xml');
		expect(response.status()).toBe(200);
		const xml = await response.text();
		const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);

		expect(locs.length).toBeGreaterThan(2600);
		expect(new Set(locs).size).toBe(locs.length);
		expect(locs.every((loc) => loc.startsWith(SITE))).toBe(true);
		expect(locs.some((loc) => loc.includes('/en/exercise/'))).toBe(true);

		// Rendering 2693 pages in one test is too slow; sample evenly plus EN exercises.
		const step = Math.max(1, Math.floor(locs.length / 40));
		const sample = new Set<string>();
		for (let i = 0; i < locs.length; i += step) sample.add(locs[i]);
		for (const loc of locs.filter((item) => item.includes('/en/exercise/')).slice(0, 5)) {
			sample.add(loc);
		}

		for (const loc of sample) {
			const path = new URL(loc).pathname + new URL(loc).search;
			const pageResponse = await request.get(path);
			expect(pageResponse.status(), `${path} from sitemap`).toBe(200);
		}
	});
});
