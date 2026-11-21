import { expect, test } from '@playwright/test';
import { i18nLeaks, placeholderLeaks } from '../helpers/app';

/**
 * Every public route that should render for a guest. Dynamic exercise pages are
 * covered by the sitemap sample; the hub + one canonical exercise are here.
 */
const ROUTES: { path: string; lang: 'ru' | 'en' }[] = [
	{ path: '/', lang: 'ru' },
	{ path: '/tools', lang: 'ru' },
	{ path: '/tools/one-rep-max', lang: 'ru' },
	{ path: '/tools/calories', lang: 'ru' },
	{ path: '/tools/bmi', lang: 'ru' },
	{ path: '/tools/heart-rate-zones', lang: 'ru' },
	{ path: '/programs', lang: 'ru' },
	{ path: '/programs/full-body-3x', lang: 'ru' },
	{ path: '/programs/upper-lower-4x', lang: 'ru' },
	{ path: '/exercises', lang: 'ru' },
	{ path: '/exercises/records', lang: 'ru' },
	{ path: '/exercises/saved', lang: 'ru' },
	{ path: '/catalog/chest', lang: 'ru' },
	{ path: '/exercise/0001', lang: 'ru' },
	{ path: '/articles', lang: 'ru' },
	{ path: '/workouts', lang: 'ru' },
	{ path: '/builder', lang: 'ru' },
	{ path: '/progress', lang: 'ru' },
	{ path: '/cycle', lang: 'ru' },
	{ path: '/ai', lang: 'ru' },
	{ path: '/auth', lang: 'ru' },
	{ path: '/auth/interface', lang: 'ru' },
	{ path: '/auth/training', lang: 'ru' },
	{ path: '/auth/account', lang: 'ru' },
	{ path: '/auth/data', lang: 'ru' },
	{ path: '/auth/workout', lang: 'ru' },
	{ path: '/auth/coach', lang: 'ru' },
	{ path: '/auth/pro', lang: 'ru' },
	{ path: '/coach', lang: 'ru' },
	{ path: '/clients', lang: 'ru' },
	{ path: '/privacy', lang: 'ru' },
	{ path: '/terms', lang: 'ru' },
	{ path: '/legal/requisites', lang: 'ru' },
	{ path: '/en/tools', lang: 'en' },
	{ path: '/en/tools/one-rep-max', lang: 'en' },
	{ path: '/en/tools/calories', lang: 'en' },
	{ path: '/en/tools/bmi', lang: 'en' },
	{ path: '/en/tools/heart-rate-zones', lang: 'en' },
	{ path: '/en/programs', lang: 'en' },
	{ path: '/en/programs/full-body-3x', lang: 'en' },
	{ path: '/en/programs/upper-lower-4x', lang: 'en' },
	{ path: '/en/exercise/0001', lang: 'en' }
];

for (const { path, lang } of ROUTES) {
	test(`public route ${path} renders in ${lang}`, async ({ page }) => {
		const response = await page.goto(path, { waitUntil: 'load' });
		expect(response?.status(), `${path} status`).toBe(200);
		await page
			.locator('#pwa-boot')
			.waitFor({ state: 'detached', timeout: 15_000 })
			.catch(() => {});

		await expect(page.locator('html')).toHaveAttribute('lang', lang);

		const body = page.locator('body');
		await expect(body).toBeVisible();
		const text = await body.innerText();
		expect(text.trim().length, `${path} body text`).toBeGreaterThan(20);

		expect(i18nLeaks(text), `${path} i18n key leaks`).toEqual([]);
		expect(placeholderLeaks(text), `${path} placeholders`).toEqual([]);
		expect(text).not.toContain('NaN');
	});
}
