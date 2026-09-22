import { test, expect } from '@playwright/test';
import { gotoReady, seedGuestStorage, waitAppReady } from './helpers/app-ready';
import {
	acceptLegalConsent,
	fillEmail,
	gotoAuth
} from './helpers/auth';

/**
 * Stable-release regression guards: SEO, legacy redirects, legal meta,
 * magic-link consent, analytics opt-in persist.
 */
test.beforeEach(async ({ page }) => {
	await seedGuestStorage(page);
});

test('robots.txt disallows app routes and points at sitemap', async ({ request }) => {
	const res = await request.get('/robots.txt');
	expect(res.ok()).toBeTruthy();
	const body = await res.text();
	expect(body).toMatch(/User-agent:\s*\*/i);
	for (const path of ['/auth', '/builder', '/live/', '/workouts/', '/exercises/records', '/exercises/saved', '/scenarios']) {
		expect(body).toContain(`Disallow: ${path}`);
	}
	expect(body).not.toMatch(/sveltekit-prerender/i);
	const sitemapMatch = body.match(/Sitemap:\s*(\S+)/i);
	expect(sitemapMatch?.[1]).toMatch(/^https?:\/\/[^/\s]+\/sitemap\.xml$/i);
	expect(sitemapMatch?.[1]).not.toMatch(/sveltekit-prerender/i);
});

test('favicon.ico and sized PNG icons are reachable', async ({ request }) => {
	for (const path of ['/favicon.ico', '/favicon-16x16.png', '/favicon-32x32.png', '/favicon-48x48.png'] as const) {
		const res = await request.get(path);
		expect(res.ok(), path).toBeTruthy();
		const ctype = (res.headers()['content-type'] ?? '').toLowerCase();
		if (path.endsWith('.ico')) {
			expect(ctype).toMatch(/icon|octet-stream|image\//);
		} else {
			expect(ctype).toMatch(/image\/png/);
		}
	}
});

test('sitemap.xml includes legal and hub paths', async ({ request }) => {
	const res = await request.get('/sitemap.xml');
	expect(res.ok()).toBeTruthy();
	const body = await res.text();
	expect(body).not.toMatch(/sveltekit-prerender/i);
	for (const path of ['/privacy', '/terms', '/exercises', '/articles'] as const) {
		expect(body).toMatch(new RegExp(`<loc>https?://[^<]+${path.replace(/\//g, '\\/')}</loc>`));
	}
});

test('public hub pages do not bake prerender placeholder canonical', async ({ page }) => {
	for (const path of ['/', '/articles', '/privacy'] as const) {
		await gotoReady(page, path);
		const canonical = page.locator('link[rel="canonical"]');
		if ((await canonical.count()) === 0) continue;
		const href = (await canonical.first().getAttribute('href')) ?? '';
		expect(href, `canonical on ${path}`).not.toMatch(/sveltekit-prerender/i);
		expect(href, `canonical on ${path}`).toMatch(/^https?:\/\//);
	}
});

test('legal pages stay indexable with meta description', async ({ page }) => {
	for (const path of ['/terms', '/privacy'] as const) {
		await gotoReady(page, path);
		const robots = page.locator('meta[name="robots"]');
		if ((await robots.count()) > 0) {
			const content = (await robots.first().getAttribute('content')) ?? '';
			expect(content.toLowerCase()).not.toContain('noindex');
		}
		await expect(page.locator('meta[name="description"]').first()).toHaveAttribute(
			'content',
			/.+/
		);
		await expect(page.locator('.privacy-page').first()).toBeVisible();
	}
});

test('legacy redirects: /records and /settings', async ({ page }) => {
	await page.goto('/records', { waitUntil: 'domcontentloaded' });
	await page.waitForURL(/\/exercises\/records/, { timeout: 15_000 });
	await waitAppReady(page);
	expect(page.url()).toMatch(/\/exercises\/records/);

	await page.goto('/settings', { waitUntil: 'domcontentloaded' });
	await page.waitForURL(/\/auth/, { timeout: 15_000 });
	await waitAppReady(page);
	expect(new URL(page.url()).pathname).toBe('/auth');
});

test('magic link submit stays disabled until legal consent', async ({ page }) => {
	await gotoAuth(page);
	await page.getByRole('button', { name: /ссылке на email|email link/i }).click();
	await fillEmail(page, 'magic-consent@example.com');
	const submit = page.getByRole('button', { name: /^(Прислать ссылку|Send link)$/ });
	await expect(submit).toBeDisabled();
	await acceptLegalConsent(page);
	await expect(submit).toBeEnabled();
});

test('web analytics opt-in persists in localStorage', async ({ page }) => {
	await gotoAuth(page);
	const toggle = page.getByRole('checkbox', { name: /Веб-аналитика|Web analytics/i });
	await expect(toggle).toBeVisible();
	await expect(toggle).not.toBeChecked();

	const before = await page.evaluate(() => localStorage.getItem('repdraft:web-analytics'));
	expect(before === null || before === '0').toBeTruthy();

	await toggle.check();
	await expect
		.poll(async () => page.evaluate(() => localStorage.getItem('repdraft:web-analytics')))
		.toBe('1');

	await page.reload({ waitUntil: 'domcontentloaded' });
	await waitAppReady(page);
	await expect(page.getByRole('checkbox', { name: /Веб-аналитика|Web analytics/i })).toBeChecked();
});
