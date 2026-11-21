import { expect, test } from '@playwright/test';
import { gotoApp } from '../helpers/app';

/** Phone-sized viewport: no horizontal page scroll on the public + core screens. */
test.use({
	viewport: { width: 390, height: 844 },
	deviceScaleFactor: 2,
	isMobile: true,
	hasTouch: true
});

const ROUTES = [
	'/',
	'/tools',
	'/tools/bmi',
	'/tools/calories',
	'/programs',
	'/programs/full-body-3x',
	'/en/programs',
	'/exercise/0001',
	'/workouts',
	'/builder',
	'/auth'
];

for (const path of ROUTES) {
	test(`390px: ${path} has no horizontal overflow`, async ({ page }) => {
		await gotoApp(page, path);
		await expect(page.locator('body')).toBeVisible();
		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - window.innerWidth
		);
		expect(overflow, `${path} overflow px`).toBeLessThanOrEqual(1);
	});
}
