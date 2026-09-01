import { test, expect } from '@playwright/test';
import { gotoReady, seedGuestStorage, waitAppReady } from './helpers/app-ready';

const OFFLINE_PLAN = {
	id: 'e2e-offline-plan',
	name: 'Offline E2E',
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:00:00.000Z',
	exercises: [{ exerciseId: '0001', sets: 1, reps: 8, restSec: 90 }]
};

test.beforeEach(async ({ page }) => {
	await seedGuestStorage(page);
	page.on('dialog', (d) => d.accept());
});

test('guest workouts stay usable when cloud is blocked (VPN-like)', async ({ page, context }) => {
	await page.addInitScript((plan) => {
		localStorage.setItem('repdraft:plans', JSON.stringify([plan]));
		document.cookie = 'repdraft_home_has_plans=1; path=/; Max-Age=31536000; SameSite=Lax';
	}, OFFLINE_PLAN);

	await context.route('**/*supabase.co/**', (route) => route.abort('failed'));
	await gotoReady(page, '/workouts');
	await expect(page.locator('.entity-row__title', { hasText: 'Offline E2E' })).toBeVisible({
		timeout: 15_000
	});
});

test('guest can log a set while offline after local boot', async ({ page, context }, testInfo) => {
	test.setTimeout(120_000);
	const isMobile = testInfo.project.name.startsWith('mobile');
	const stamp = `Offline ${Date.now().toString(36).slice(-4)}`;

	await gotoReady(page, '/builder?new=1');
	const nameInput = isMobile
		? page.locator('.builder-chrome__name')
		: page.locator('.builder-name-desktop input[type="text"]');
	await nameInput.waitFor({ state: 'visible', timeout: 10_000 });
	await nameInput.fill(stamp);

	const pickFab = page.locator('.app-fab[href*="exercises"]').first();
	if ((await pickFab.count()) > 0 && (await pickFab.isVisible())) {
		await pickFab.click();
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

	const saveBtn = isMobile
		? page.locator('.sticky-actions button.btn-primary').filter({ hasText: /Сохранить|Save/ })
		: page.locator('.builder-toolbar-save');
	await expect(saveBtn.first()).toBeEnabled({ timeout: 10_000 });
	await saveBtn.first().click({ timeout: 15_000 });
	await page.waitForURL(/\/workouts\/?$/, { timeout: 25_000 });
	await waitAppReady(page);

	const planRow = page.locator('.entity-row__main', { hasText: stamp }).first();
	await planRow.waitFor({ state: 'visible', timeout: 10_000 });
	const previewHref = await planRow.getAttribute('href');
	expect(previewHref).toMatch(/^\/workouts\/[^/]+$/);
	await gotoReady(page, previewHref!);
	await page.locator('.workout-preview-list').waitFor({ state: 'visible', timeout: 15_000 });

	const startBtn = isMobile
		? page.locator('.workout-preview .sticky-actions button.btn-primary')
		: page.locator('.workout-preview-actions-desktop button.btn-primary');
	await startBtn.waitFor({ state: 'visible', timeout: 15_000 });
	await startBtn.click();
	await page.waitForURL(/\/live\//, { timeout: 20_000 });
	await waitAppReady(page);
	await page.locator('.live-panel').waitFor({ state: 'visible', timeout: 15_000 });

	await context.setOffline(true);

	const weight = page.locator('input.live-set-weight:not([readonly])').first();
	const reps = page.locator('input.live-set-reps:not([readonly])').first();
	await weight.fill('40');
	await reps.fill('8');
	const done = page.locator('.live-set-done-btn:not(.live-set-done-btn--done)').first();
	if ((await done.count()) > 0) await done.click();

	await expect(page.locator('.live-panel')).toBeVisible();
	await expect(page.locator('.network-status-chip')).toContainText(/Без сети|Offline/);
});
