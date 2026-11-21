import { expect, test } from '@playwright/test';
import { gotoApp } from '../helpers/app';

test.describe('language and /en mirrors', () => {
	test('EN program hub links only to EN content', async ({ page }) => {
		await gotoApp(page, '/en/programs');
		await expect(page.locator('html')).toHaveAttribute('lang', 'en');
		const hrefs = await page.evaluate(() =>
			[...document.querySelectorAll('a[href^="/"]')].map((anchor) => anchor.getAttribute('href') ?? '')
		);
		const ruContentLinks = hrefs.filter((href) => /^\/(tools|programs|exercise)(\/|$)/.test(href));
		expect(ruContentLinks).toEqual([]);
	});

	test('EN exercise page stays English and adds to the local plan', async ({ page }) => {
		await gotoApp(page, '/en/exercise/0002');
		await expect(page.locator('html')).toHaveAttribute('lang', 'en');

		const add = page.getByRole('button', { name: /Add to plan/i }).first();
		await expect(add).toBeVisible();
		await add.click();
		await expect(page.locator('[role="status"]').filter({ hasText: 'Added to plan' }).first()).toBeVisible();

		const draft = await page.evaluate(() => localStorage.getItem('repdraft:draft'));
		expect(draft).toContain('0002');
		const body = await page.locator('body').innerText();
		expect(body).not.toMatch(/Добавить в план|Техника|История/);
	});

	test('profile language switch follows the preference and the URL', async ({ page }) => {
		// Default context is ru-RU; start from the Russian interface.
		await gotoApp(page, '/auth/interface');
		await expect(page.locator('html')).toHaveAttribute('lang', 'ru');

		await page.getByRole('button', { name: /^Язык:/ }).click();
		await expect(page.locator('html')).toHaveAttribute('lang', 'en');
		await expect(page.getByRole('button', { name: /^Language:/ })).toBeVisible();

		// `/en/*` reuses the preference but also proves the mirror forces English.
		await gotoApp(page, '/en/tools/bmi');
		await expect(page.locator('html')).toHaveAttribute('lang', 'en');

		// A Russian URL keeps the stored English preference until the user switches back.
		await gotoApp(page, '/tools/bmi');
		await expect(page.locator('html')).toHaveAttribute('lang', 'en');

		await gotoApp(page, '/auth/interface');
		await page.getByRole('button', { name: /^Language:/ }).click();
		await expect(page.locator('html')).toHaveAttribute('lang', 'ru');

		await gotoApp(page, '/tools/bmi');
		await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
	});
});
