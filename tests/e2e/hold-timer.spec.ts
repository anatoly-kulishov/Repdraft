import { expect, test } from '@playwright/test';
import { finishLiveSession, gotoApp, seedLocalStorage } from '../helpers/app';

const at = new Date(Date.now() - 3_600_000).toISOString();

/** A plank is a hold: 2 × 45 «seconds», not 2 × 45 reps. */
const plank = {
	id: 'plan-plank',
	name: 'E2E планка',
	createdAt: at,
	updatedAt: at,
	exercises: [{ exerciseId: '0464', sets: 2, reps: 45, restSec: 60 }]
};
const measuredPlank = {
	...plank,
	exercises: [{ exerciseId: '0464', sets: 2, reps: 45, restSec: 60, measure: 'seconds' }]
};

/** Steady cardio: a treadmill block is 2 × 20 «минут», not 2 × 20 reps. */
const cardio = {
	id: 'plan-treadmill',
	name: 'E2E дорожка',
	createdAt: at,
	updatedAt: at,
	exercises: [{ exerciseId: '0685', sets: 2, reps: 12, restSec: 60 }]
};
const measuredCardio = {
	...cardio,
	exercises: [{ exerciseId: '0685', sets: 2, reps: 20, restSec: 60, measure: 'minutes' }]
};

test('the builder can count a hold in seconds instead of reps', async ({ page }) => {
	await seedLocalStorage(page, { 'repdraft:plans': [plank] });
	await gotoApp(page, '/builder/plan-plank');

	const row = page.locator('.workout-ex-row').first();
	const repsChip = row.locator('.workout-ex-chip').filter({ hasText: 'Повторы' }).first();
	await expect(repsChip).toBeVisible();

	await row.getByRole('button', { name: 'Действия упражнения' }).click();
	await page.getByRole('button', { name: 'Считать по времени' }).click();

	await expect(
		row.locator('.workout-ex-chip').filter({ hasText: 'Секунды' }).first()
	).toBeVisible();

	await page.getByRole('button', { name: 'Сохранить', exact: true }).first().click();
	await expect(page).toHaveURL(/\/workouts$/, { timeout: 20_000 });
	await expect
		.poll(async () =>
			page.evaluate(() => {
				const plans = JSON.parse(localStorage.getItem('repdraft:plans') ?? '[]');
				return plans[0]?.exercises?.[0]?.measure ?? null;
			})
		)
		.toBe('seconds');
});

test('a hold logs seconds and the stopwatch fills a set', async ({ page }) => {
	await seedLocalStorage(page, { 'repdraft:plans': [measuredPlank] });
	await gotoApp(page, '/workouts/plan-plank');

	await expect(page.locator('.workout-preview-row-sub').first()).toContainText('2 × 45 сек');

	await page.getByRole('button', { name: 'Старт', exact: true }).click();
	await expect(page).toHaveURL(/\/live\//, { timeout: 20_000 });

	const panel = page.locator('.live-panel').first();
	await expect(panel.locator('.live-set-head__reps')).toHaveText('Секунды');

	const firstRow = panel.locator('.live-set-row').first();
	const timer = firstRow.locator('.live-set-timer');
	await expect(timer).toBeVisible();
	await timer.click();
	await expect(timer).toContainText(/0:0[0-2]/);
	await page.waitForTimeout(1_200);
	await timer.click();

	// Stop: the measured time is written into the set and the set is marked done.
	await expect(firstRow).toHaveClass(/is-done/);
	const seconds = Number(await firstRow.locator('.live-set-reps').inputValue());
	expect(seconds).toBeGreaterThanOrEqual(1);
	expect(seconds).toBeLessThanOrEqual(5);
});

test('cardio switches to minutes instead of reps', async ({ page }) => {
	await seedLocalStorage(page, { 'repdraft:plans': [cardio] });
	await gotoApp(page, '/builder/plan-treadmill');

	const row = page.locator('.workout-ex-row').first();
	await expect(row.locator('.workout-ex-chip').filter({ hasText: 'Повторы' }).first()).toBeVisible();

	await row.getByRole('button', { name: 'Действия упражнения' }).click();
	await page.getByRole('button', { name: 'Считать по времени' }).click();

	// Cardio counts minutes, so the fresh timed value is a plausible block (20).
	await expect(row.locator('.workout-ex-chip').filter({ hasText: 'Минуты' }).first()).toBeVisible();

	await page.getByRole('button', { name: 'Сохранить', exact: true }).first().click();
	await expect(page).toHaveURL(/\/workouts$/, { timeout: 20_000 });
	const saved = await page.evaluate(() => {
		const plans = JSON.parse(localStorage.getItem('repdraft:plans') ?? '[]');
		return plans[0]?.exercises?.[0] ?? null;
	});
	expect(saved?.measure).toBe('minutes');
	expect(saved?.reps).toBe(20);
});

test('a treadmill block logs minutes and the stopwatch fills a set', async ({ page }) => {
	await seedLocalStorage(page, { 'repdraft:plans': [measuredCardio] });
	await gotoApp(page, '/workouts/plan-treadmill');

	await expect(page.locator('.workout-preview-row-sub').first()).toContainText('2 × 20 мин');

	await page.getByRole('button', { name: 'Старт', exact: true }).click();
	await expect(page).toHaveURL(/\/live\//, { timeout: 20_000 });

	const panel = page.locator('.live-panel').first();
	await expect(panel.locator('.live-set-head__reps')).toHaveText('Минуты');
	await expect(panel.locator('.live-set-head__weight')).toHaveCount(0);

	const firstRow = panel.locator('.live-set-row').first();
	await expect(firstRow.locator('input[aria-label^="Вес"]')).toHaveCount(0);

	const timer = firstRow.locator('.live-set-timer');
	await timer.click();
	await expect(timer).toContainText(/0:0[0-2]/);
	await page.waitForTimeout(1_200);
	await timer.click();

	// Stop: minutes are rounded up from zero, so a short probe still logs «1 мин».
	await expect(firstRow).toHaveClass(/is-done/);
	expect(Number(await firstRow.locator('.live-set-reps').inputValue())).toBe(1);

	await finishLiveSession(page);
	await expect(page.getByText('1 мин', { exact: false }).first()).toBeVisible();
});
