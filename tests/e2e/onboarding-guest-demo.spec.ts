import { test, expect } from '@playwright/test';
import { gotoReady, seedGuestStorage, waitAppReady } from './helpers/app-ready';

test.beforeEach(async ({ page }) => {
	await seedGuestStorage(page);
	page.on('dialog', (d) => d.accept());
});

async function dismissCoachmarks(page: import('@playwright/test').Page) {
	const dismiss = page.locator('.onboarding-coachmark__dismiss');
	for (let i = 0; i < 6; i++) {
		const btn = dismiss.first();
		if ((await btn.count()) === 0 || !(await btn.isVisible())) break;
		await btn.click();
		await page.waitForTimeout(200);
	}
}

async function skipRestIfVisible(page: import('@playwright/test').Page) {
	const skipRest = page.locator('.live-rest__skip').first();
	if ((await skipRest.count()) > 0 && (await skipRest.isVisible())) {
		await skipRest.click();
	}
}

test('onboarding: demo path to first finish', async ({ page }, testInfo) => {
	test.setTimeout(120_000);
	const isMobile = testInfo.project.name.startsWith('mobile');

	await gotoReady(page, '/?onboarding=reset');
	await expect(page.locator('.onboarding-checklist')).toBeVisible({ timeout: 10_000 });

	await page.locator('.onboarding-checklist__demo').click();
	await page.waitForURL(/\/workouts\/repdraft-onboarding-demo/, { timeout: 20_000 });
	await waitAppReady(page);
	await dismissCoachmarks(page);

	const startBtn = isMobile
		? page.locator('.workout-preview .sticky-actions button.btn-primary')
		: page.locator('.workout-preview-actions-desktop button.btn-primary');
	await startBtn.waitFor({ state: 'visible', timeout: 15_000 });
	await startBtn.click();
	await page.waitForURL(/\/live\//, { timeout: 20_000 });
	await waitAppReady(page);
	await dismissCoachmarks(page);

	const weight = page.locator('input.live-set-weight:not([readonly])').first();
	const reps = page.locator('input.live-set-reps:not([readonly])').first();
	if ((await weight.count()) > 0) {
		await weight.fill('40');
		await reps.fill('8');
	}
	const done = page.locator('.live-set-done-btn:not(.live-set-done-btn--done)').first();
	if ((await done.count()) > 0) await done.click();
	await skipRestIfVisible(page);
	await dismissCoachmarks(page);

	await page.locator('.live-nav-item').last().click();
	await waitAppReady(page);
	await skipRestIfVisible(page);
	await dismissCoachmarks(page);

	const finishTrigger = isMobile
		? page.locator('.live-sticky-actions .live-session-pair button').filter({ hasText: /Завершить|Finish/ })
		: page.locator('.live-desktop-actions button').filter({ hasText: /Завершить|Finish/ });
	await finishTrigger.waitFor({ state: 'visible', timeout: 15_000 });
	await finishTrigger.click();

	const finishConfirm = page
		.locator('.bottom-sheet button.btn-primary')
		.filter({ hasText: /Завершить|Finish/ })
		.last();
	await finishConfirm.waitFor({ state: 'visible', timeout: 10_000 });
	await finishConfirm.click();

	await page.waitForURL(/\/workouts\/summary/, { timeout: 25_000 });
	await waitAppReady(page);
	await expect(page.locator('.onboarding-first-finish')).toBeVisible({ timeout: 10_000 });
});

test('onboarding: dismissed coachmark does not re-show', async ({ page }) => {
	test.setTimeout(90_000);

	await gotoReady(page, '/?onboarding=reset');
	await page.locator('.onboarding-checklist__demo').click();
	await page.waitForURL(/\/workouts\/repdraft-onboarding-demo/, { timeout: 20_000 });
	await waitAppReady(page);

	await expect(page.locator('.onboarding-coachmark')).toHaveCount(1, { timeout: 10_000 });
	await page.locator('.onboarding-coachmark__dismiss').first().click();
	await expect(page.locator('.onboarding-coachmark')).toHaveCount(0, { timeout: 5_000 });

	await page.reload({ waitUntil: 'domcontentloaded' });
	await waitAppReady(page);
	await expect(page.locator('.onboarding-coachmark')).toHaveCount(0);
});
