import { expect, test } from '@playwright/test';
import {
	draftPlan,
	finishLiveSession,
	gotoApp,
	rateFinishedSession,
	seedLocalStorage
} from '../helpers/app';

test.describe('sacred loop', () => {
	test('builder draft -> plan -> live -> finish -> summary -> rating -> history', async ({
		page
	}) => {
		await seedLocalStorage(page, { 'repdraft:draft': draftPlan() });

		// 1. The builder hydrates the seeded draft and lets us rename it.
		await gotoApp(page, '/builder');
		await expect(page.locator('.workout-ex-row')).toHaveCount(2);
		const nameInput = page.locator('input[aria-label="Название"]:visible').first();
		await nameInput.fill('E2E полноценная тренировка');

		await page
			.getByRole('button', { name: 'Сохранить', exact: true })
			.first()
			.click();
		await expect(page).toHaveURL(/\/workouts$/, { timeout: 20_000 });

		const plans = JSON.parse((await page.evaluate(() => localStorage.getItem('repdraft:plans'))) ?? '[]');
		expect(plans).toHaveLength(1);
		expect(plans[0].name).toBe('E2E полноценная тренировка');
		const planId = plans[0].id as string;

		// 2. Start the saved plan and finish every set.
		await gotoApp(page, `/workouts/${planId}`);
		await expect(page.locator('h1')).toContainText('E2E полноценная тренировка');
		await page.getByRole('button', { name: 'Старт', exact: true }).click();
		await expect(page).toHaveURL(/\/live\//, { timeout: 20_000 });

		await finishLiveSession(page);

		// 3. Summary asks for a rating once and persists it.
		await expect(page.locator('.session-rating')).toBeVisible();
		await rateFinishedSession(page, 4);
		const summaryUrl = page.url();

		await page.reload({ waitUntil: 'load' });
		await expect(page.locator('.session-rating [aria-pressed="true"]')).toHaveCount(1);
		expect(new URL(summaryUrl).searchParams.get('id')).toBeTruthy();

		// 4. The finished session lands in history.
		await gotoApp(page, '/workouts?tab=history');
		const historyLink = page.locator('a[href^="/workouts/history/"]').first();
		await expect(historyLink).toBeVisible();
		await historyLink.click();
		await expect(page).toHaveURL(/\/workouts\/history\//);
		await expect(page.locator('body')).toContainText('E2E полноценная тренировка');
	});

	test('empty builder points at the catalog instead of pretending to be a plan', async ({
		page
	}) => {
		await gotoApp(page, '/builder?new=1');
		await expect(page.locator('.workout-ex-row')).toHaveCount(0);
		const add = page.locator('a[href*="from=%2Fbuilder"]:visible').first();
		await expect(add).toBeVisible();
		await add.click();
		await expect(page).toHaveURL(/\/exercises\?from=%2Fbuilder/);
	});
});
