import { expect, test } from '@playwright/test';
import { gotoApp, seedLocalStorage } from '../helpers/app';

/** A seeded mesocycle boots straight into the summary + chart, no setup form. */
const CYCLE = {
	id: 'cycle-e2e',
	name: 'E2E волна',
	createdAt: '2026-11-16T00:00:00.000Z',
	updatedAt: '2026-11-16T00:00:00.000Z',
	startDate: mondayOfThisWeek(),
	weeks: 8,
	goal: 'muscle',
	planIds: ['plan-e2e']
};

/** Week 1 must stay current whenever the suite runs, not only in its launch week. */
function mondayOfThisWeek(): string {
	const date = new Date();
	const shift = (date.getDay() + 6) % 7;
	date.setDate(date.getDate() - shift);
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${date.getFullYear()}-${month}-${day}`;
}

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

/**
 * The week is a prescription, not a percentage: it names the sets, the reps and
 * the load for each exercise — and the load respects the implement (an EZ bar is
 * ~10 kg, so «12.5 kg» is not a weight the athlete can build).
 */
test('a cycle week names sets and load, and starts the session with them', async ({ page }) => {
	// Last exposure is older than this cycle week, so the week still has its start CTA.
	const at = new Date(Date.now() - 30 * 86_400_000).toISOString();
	const ezPlan = {
		id: 'plan-ez',
		name: 'E2E бицепс',
		createdAt: at,
		updatedAt: at,
		exercises: [{ exerciseId: '2404', sets: 3, reps: 8, restSec: 90 }]
	};
	const ezHistory = {
		id: 'session-ez',
		planId: 'plan-ez',
		planName: 'E2E бицепс',
		startedAt: at,
		finishedAt: at,
		exercises: [
			{
				exerciseId: '2404',
				targetSets: 3,
				targetReps: 8,
				restSec: 90,
				sets: [
					{ weightKg: 20, reps: 8, completed: true, kind: 'work' },
					{ weightKg: 20, reps: 8, completed: true, kind: 'work' },
					{ weightKg: 20, reps: 8, completed: true, kind: 'failure' }
				]
			}
		]
	};
	await seedLocalStorage(page, {
		'repdraft:plans': [ezPlan],
		'repdraft:cycle': { ...CYCLE, planIds: ['plan-ez'] },
		'repdraft:sessions': [ezHistory]
	});
	await gotoApp(page, '/cycle');

	const slot = page.locator('.cycle-week__plan').first();
	// Days start folded — the row is the accordion header (name + exercise count),
	// so a week opens as four lines instead of four full prescriptions.
	const toggle = slot.locator('.cycle-week__plan-toggle');
	await expect(toggle).toHaveAttribute('aria-expanded', 'false');
	await expect(slot.locator('.cycle-week__rx-row')).toHaveCount(0);
	await expect(toggle).toContainText('1 упражнение');
	await toggle.click();
	await expect(toggle).toHaveAttribute('aria-expanded', 'true');

	const row = slot.locator('.cycle-week__rx-row').first();
	// Intensity week of the muscle goal: 3 × 8 shifts to 2 × 6.
	await expect(row).toContainText('2 × 6');
	// «В отказ» closed the plan: hold 20 kg, and the EZ bar is inside the number.
	await expect(row).toContainText('20 кг');
	await expect(row).toContainText('гриф 10 кг');
	await expect(slot.locator('.cycle-week__rx-total')).toContainText('Всего подходов: 2');

	await slot.getByRole('button', { name: 'Начать' }).click();
	await page.waitForURL('**/live/plan-ez');

	const weights = page.locator('.live-set-weight');
	const reps = page.locator('.live-set-reps');
	await expect(weights).toHaveCount(2);
	await expect(weights.first()).toHaveValue('20');
	await expect(reps.first()).toHaveValue('6');
});
