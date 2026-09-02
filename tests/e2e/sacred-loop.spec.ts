import { test, expect } from '@playwright/test';
import { gotoReady, seedGuestStorage, stabilizeChrome, waitAppReady } from './helpers/app-ready';
import {
	builderNameInput,
	builderSaveButton,
	workoutPreviewStartButton
} from './helpers/flow-locators';

test.beforeEach(async ({ page }) => {
	await seedGuestStorage(page);
	page.on('dialog', (d) => d.accept());
});

test('sacred loop: create → pick → save → preview → live set → finish', async ({ page }, testInfo) => {
	test.setTimeout(90_000);
	const isMobile = testInfo.project.name.startsWith('mobile');
	const stamp = `E2E ${testInfo.project.name} ${Date.now().toString(36).slice(-4)}`;

	await gotoReady(page, '/builder?new');
	const nameInput = builderNameInput(page);
	await nameInput.waitFor({ state: 'visible', timeout: 10_000 });
	await nameInput.fill(stamp);

	const pickFab = page.locator('.app-fab[href*="exercises"]').first();
	const pickLink = page.locator('a[href*="/exercises?from="]').first();
	if ((await pickFab.count()) > 0 && (await pickFab.isVisible())) {
		await pickFab.click();
	} else if ((await pickLink.count()) > 0 && (await pickLink.isVisible())) {
		await pickLink.click();
	} else {
		await page.goto('/exercises?from=%2Fbuilder');
	}
	await waitAppReady(page);

	if (page.url().includes('/exercises')) {
		await page.locator('a[href^="/catalog/"]').first().click();
		await waitAppReady(page);
		const browseAll = page.locator('a[href*="browse=all"]').first();
		if ((await browseAll.count()) > 0 && (await browseAll.isVisible())) {
			await browseAll.click();
			await waitAppReady(page);
		}
	}

	const addBtn = page.locator('.exercise-card-add').first();
	await addBtn.waitFor({ state: 'visible', timeout: 15_000 });
	await addBtn.click();
	await waitAppReady(page);

	if (!page.url().includes('/builder')) {
		await gotoReady(page, '/builder');
	}

	const saveBtn = builderSaveButton(page, isMobile);
	await expect(saveBtn).toBeEnabled({ timeout: 10_000 });
	await saveBtn.click({ timeout: 15_000 });
	await page.waitForURL(/\/workouts\/?$/, { timeout: 25_000 });
	await waitAppReady(page);

	const planRow = page.locator('.entity-row__main', { hasText: stamp }).first();
	await planRow.waitFor({ state: 'visible', timeout: 10_000 });
	const previewHref = await planRow.getAttribute('href');
	expect(previewHref).toMatch(/^\/workouts\/[^/]+$/);
	await gotoReady(page, previewHref!);
	await page.locator('.workout-preview-list').waitFor({ state: 'visible', timeout: 15_000 });

	const startBtn = workoutPreviewStartButton(page, isMobile);
	await startBtn.waitFor({ state: 'visible', timeout: 15_000 });
	await startBtn.click();
	await page.waitForURL(/\/live\//, { timeout: 20_000 });
	await waitAppReady(page);

	const weight = page.locator('input.live-set-weight:not([readonly])').first();
	const reps = page.locator('input.live-set-reps:not([readonly])').first();
	if ((await weight.count()) > 0) {
		await weight.fill('40');
		await reps.fill('8');
		const done = page.locator('.live-set-done-btn:not(.live-set-done-btn--done)').first();
		if ((await done.count()) > 0) await done.click();
	}

	await expect(page.locator('.live-panel')).toBeVisible();
	await stabilizeChrome(page);
	await expect(page).toHaveScreenshot('sacred-loop-live.png', { fullPage: false });
});
