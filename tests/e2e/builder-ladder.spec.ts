import { test, expect } from '@playwright/test';
import { gotoReady, seedGuestStorage, waitAppReady } from './helpers/app-ready';
import { builderNameInput, builderSaveButton } from './helpers/flow-locators';

test.beforeEach(async ({ page }) => {
	await seedGuestStorage(page);
	page.on('dialog', (d) => d.accept());
});

test('builder: ladder 5→1 shows chip and persists on save', async ({ page }, testInfo) => {
	test.setTimeout(90_000);
	const isMobile = testInfo.project.name.startsWith('mobile');
	const stamp = `Ladder ${testInfo.project.name} ${Date.now().toString(36).slice(-4)}`;

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

	await page.locator('.workout-ex-head').first().waitFor({ state: 'visible', timeout: 10_000 });
	await page.getByRole('button', { name: /^(Действия упражнения|Exercise actions)$/ }).first().click();
	await page.locator('button.builder-ex-action').filter({ hasText: /Лесенка|Ladder/i }).click();

	const sheet = page.locator('.bottom-sheet').filter({ hasText: /Лесенка повторов|Rep ladder/i });
	await expect(sheet).toBeVisible();
	const fromInput = sheet.locator('input').nth(0);
	const toInput = sheet.locator('input').nth(1);
	await fromInput.fill('5');
	await toInput.fill('1');
	await sheet.getByRole('button', { name: /^(Применить|Apply)$/ }).click();
	await expect(page.locator('.bottom-sheet')).toHaveCount(0);

	await expect(page.locator('.workout-ex-chip--ladder').first()).toBeVisible();
	await expect(page.locator('.workout-ex-chip__ladder-value').first()).toHaveText('5→1');

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
	await expect(page.getByText('5→1').first()).toBeVisible({ timeout: 10_000 });
});
