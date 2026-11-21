import { expect, test } from '@playwright/test';
import { gotoApp, seedLocalStorage } from '../helpers/app';

/** A seeded mesocycle boots straight into the summary + chart, no setup form. */
const CYCLE = {
	id: 'cycle-e2e',
	name: 'E2E волна',
	createdAt: '2026-11-16T00:00:00.000Z',
	updatedAt: '2026-11-16T00:00:00.000Z',
	startDate: '2026-11-16',
	weeks: 8,
	goal: 'muscle',
	planIds: ['plan-e2e']
};

/** The workouts promo only renders above a non-empty plan list. */
const PLAN = {
	id: 'plan-e2e',
	name: 'День ног',
	createdAt: '2026-11-16T00:00:00.000Z',
	updatedAt: '2026-11-16T00:00:00.000Z',
	exercises: [{ exerciseId: '0001', sets: 3, reps: 10, restSec: 90 }]
};

test('cycle wave runs intensity, volume, unload with the volume peak on week 2', async ({ page }) => {
	await seedLocalStorage(page, { 'repdraft:cycle': CYCLE });
	await gotoApp(page, '/cycle');

	await expect(page.locator('svg.cycle-chart')).toBeVisible();

	const weeks = page.locator('.cycle-weeks > li');
	await expect(weeks).toHaveCount(8);

	const kind = (index: number) => weeks.nth(index).locator('.cycle-week__kind');
	const meta = (index: number) => weeks.nth(index).locator('.cycle-week__meta');

	await expect(kind(0)).toHaveText('Интенсивность');
	await expect(meta(0)).toContainText('объём 80%');
	await expect(meta(0)).toContainText('интенсивность 112%');

	// Volume owns the peak: the classic chart peaks it one week after intensity.
	await expect(kind(1)).toHaveText('Объём');
	await expect(meta(1)).toContainText('объём 118%');
	await expect(meta(1)).toContainText('интенсивность 92%');

	// Third week drops both axes instead of adding more volume.
	await expect(kind(2)).toHaveText('Разгрузка');
	await expect(meta(2)).toContainText('объём 66%');
	await expect(meta(2)).toContainText('интенсивность 80%');

	// The block repeats.
	await expect(kind(3)).toHaveText('Интенсивность');
	await expect(weeks.nth(5).locator('.cycle-week__kind')).toHaveText('Разгрузка');
});

test('the cycle page survives a reload with the wave intact', async ({ page }) => {
	await seedLocalStorage(page, { 'repdraft:cycle': CYCLE });
	await gotoApp(page, '/cycle');
	await expect(page.locator('.cycle-weeks > li')).toHaveCount(8);

	await page.reload({ waitUntil: 'load' });
	await expect(page.locator('svg.cycle-chart')).toBeVisible();
	await expect(page.locator('.cycle-weeks > li').nth(1).locator('.cycle-week__kind')).toHaveText(
		'Объём'
	);
});

test('the workouts promotion is a teaser row, not a chart preview', async ({ page }) => {
	await seedLocalStorage(page, {
		'repdraft:plans': [PLAN],
		// Default name equals the kicker, so the card must not print it twice.
		'repdraft:cycle': { ...CYCLE, name: 'Волновой цикл' }
	});
	await gotoApp(page, '/workouts');

	const card = page.locator('.cycle-card');
	await expect(card).toBeVisible();
	await expect(card).toContainText('Неделя 1 из 8');
	await expect(card.locator('.cycle-card__name')).toHaveCount(0);
	// The wave lives on /cycle; the promo is a row, not a preview screen. (The chevron
	// is an <svg> too, so assert on the chart itself, not on any svg.)
	await expect(card.locator('svg.cycle-chart')).toHaveCount(0);
	await expect(card.locator('.cycle-card__chevron')).toBeVisible();
});

test('a renamed cycle gets its own line in the workouts teaser', async ({ page }) => {
	await seedLocalStorage(page, { 'repdraft:plans': [PLAN], 'repdraft:cycle': CYCLE });
	await gotoApp(page, '/workouts');

	await expect(page.locator('.cycle-card .cycle-card__name')).toHaveText('E2E волна');
});
