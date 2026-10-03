import { test, expect } from '@playwright/test';
import { gotoReady, seedGuestStorage, waitAppReady } from './helpers/app-ready';
import {
	builderNameInput,
	builderSaveButton,
	workoutPreviewStartButton
} from './helpers/flow-locators';
import { isolateGuestCloud } from './helpers/skeleton-transition';

const CUSTOM_NAME = 'Жмог Теста';

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
	await seedGuestStorage(page);
	await isolateGuestCloud(page);
	page.on('dialog', (d) => d.accept());
});

async function openCreateSheetFromEmptyState(page: import('@playwright/test').Page) {
	await gotoReady(page, `/exercises?from=%2Fbuilder`);
	const search = page.getByPlaceholder(/Поиск: жим|Search: press|squat/i).first();
	await search.waitFor({ state: 'visible', timeout: 10_000 });
	await search.fill(CUSTOM_NAME);
	/** ListSearchBar debounces its value binding — Enter must fire after the flush. */
	await page.waitForTimeout(300);
	await search.press('Enter');
	await page.waitForURL(/\/catalog\/all\?q=/, { timeout: 10_000 });
	await waitAppReady(page);

	const cta = page
		.locator('.empty-state button')
		.filter({ hasText: CUSTOM_NAME })
		.first();
	await cta.waitFor({ state: 'visible', timeout: 10_000 });
	await cta.click();
}

async function submitSheet(page: import('@playwright/test').Page) {
	const sheet = page.locator('.bottom-sheet').filter({ hasText: 'Своё упражнение' }).first();
	await sheet.waitFor({ state: 'visible', timeout: 10_000 });
	await sheet.locator('input').first().fill(CUSTOM_NAME);
	await sheet.getByRole('button', { name: /^Создать$/ }).click();
}

test('create custom exercise from empty search → toast, row, draft', async ({ page }, info) => {
	test.skip(!info.project.name.startsWith('mobile'), 'phone athlete');
	test.setTimeout(60_000);

	await openCreateSheetFromEmptyState(page);
	await submitSheet(page);

	await expect(page.locator('.toast-item', { hasText: 'Добавлено в план' }).first()).toBeVisible({
		timeout: 10_000
	});
	const card = page.locator('.exercise-card', { hasText: CUSTOM_NAME }).first();
	await expect(card).toBeVisible({ timeout: 10_000 });
	await expect(card.locator('.exercise-card-custom-badge')).toHaveText('Своё');

	const stored = await page.evaluate(
		() => JSON.parse(localStorage.getItem('repdraft:custom-exercises') ?? '[]') as { id: string; name: string }[]
	);
	expect(stored.some((ex) => ex.name === CUSTOM_NAME && ex.id.startsWith('custom-'))).toBe(true);
	const draft = await page.evaluate(
		() => JSON.parse(localStorage.getItem('repdraft:draft') ?? '{}') as {
			exercises?: { exerciseId: string }[];
		}
	);
	expect(draft.exercises?.some((ex) => ex.exerciseId.startsWith('custom-'))).toBe(true);
});

test('custom exercise completes the sacred loop: builder → save → live → history', async ({
	page
}, info) => {
	test.skip(!info.project.name.startsWith('mobile'), 'phone athlete');
	test.setTimeout(120_000);

	await openCreateSheetFromEmptyState(page);
	await submitSheet(page);
	await expect(page.locator('.toast-item', { hasText: 'Добавлено в план' }).first()).toBeVisible({
		timeout: 10_000
	});

	await gotoReady(page, '/builder');
	const row = page.locator('.workout-ex-head__title', { hasText: CUSTOM_NAME }).first();
	await row.waitFor({ state: 'visible', timeout: 15_000 });

	const stamp = `Custom E2E ${Date.now().toString(36).slice(-4)}`;
	await builderNameInput(page).fill(stamp);
	await builderSaveButton(page, true).click();
	await page.waitForURL(/\/workouts\/?$/, { timeout: 25_000 });
	await waitAppReady(page);

	const planRow = page.locator('.entity-row__main', { hasText: stamp }).first();
	await planRow.waitFor({ state: 'visible', timeout: 10_000 });
	const previewHref = await planRow.getAttribute('href');
	expect(previewHref).toMatch(/^\/workouts\/[^/]+$/);
	await gotoReady(page, previewHref!);

	const startBtn = workoutPreviewStartButton(page, true);
	await startBtn.waitFor({ state: 'visible', timeout: 15_000 });
	await startBtn.click();
	await page.waitForURL(/\/live\//, { timeout: 20_000 });
	await waitAppReady(page);

	await expect(page.locator('.live-panel-title', { hasText: CUSTOM_NAME }).first()).toBeVisible({
		timeout: 15_000
	});

	const w = page.locator('input.live-set-weight:not([readonly])').first();
	const r = page.locator('input.live-set-reps:not([readonly])').first();
	await w.waitFor({ state: 'visible', timeout: 10_000 });
	await w.fill('55');
	await r.fill('6');
	await page.locator('.live-set-done-btn:not(.live-set-done-btn--done)').first().click();

	const finish = page
		.locator('.live-sticky-actions button, .sticky-actions button')
		.filter({ hasText: /Завершить|Finish/i })
		.first();
	await finish.waitFor({ state: 'visible', timeout: 15_000 });
	await finish.click();
	const sheet = page.locator('[aria-labelledby="live-finish-offer-title"]');
	await sheet.waitFor({ state: 'visible', timeout: 10_000 });
	await sheet.getByRole('button', { name: /Завершить|Finish/i }).click();
	await page.waitForURL(/\/workouts/, { timeout: 20_000 });
	await waitAppReady(page);

	const session = await page.evaluate(() => {
		const sessions = JSON.parse(localStorage.getItem('repdraft:sessions') ?? '[]') as {
			planName?: string;
			exercises?: { exerciseId: string; sets?: { completed?: boolean }[] }[];
		}[];
		return sessions.find((s) => s.planName?.startsWith('Custom E2E'));
	});
	expect(session).toBeTruthy();
	expect(session!.exercises?.[0]?.exerciseId.startsWith('custom-')).toBe(true);
	expect(session!.exercises?.[0]?.sets?.some((s) => s.completed)).toBe(true);
});
