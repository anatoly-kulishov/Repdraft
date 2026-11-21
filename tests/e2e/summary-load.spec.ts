import { expect, test } from '@playwright/test';
import { gotoApp, seedLocalStorage } from '../helpers/app';

/** Real catalog ids: 0025 chest, 0652 back, 0031 arms, 0043 quads. */
const DAY = 86_400_000;

function session(
	id: string,
	daysAgo: number,
	exercises: readonly (readonly [string, number])[]
) {
	const start = new Date(Date.now() - daysAgo * DAY);
	start.setUTCHours(9, 0, 0, 0);
	return {
		id,
		planId: 'p1',
		planName: 'E2E plan',
		startedAt: start.toISOString(),
		finishedAt: new Date(start.getTime() + 60 * 60_000).toISOString(),
		exercises: exercises.map(([exerciseId, sets]) => ({
			exerciseId,
			targetSets: sets,
			targetReps: 8,
			restSec: 90,
			sets: Array.from({ length: sets }, () => ({
				weightKg: 60,
				reps: 8,
				completed: true,
				kind: 'work'
			}))
		}))
	};
}

const SESSIONS = [
	session('today', 0, [
		['0025', 4],
		['0652', 3],
		['0031', 2]
	]),
	// Legs were trained this week, but only once: a real weekly gap, not a guess.
	session('legs', 2, [['0043', 5]])
];

const PLAN = {
	id: 'p1',
	name: 'E2E plan',
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString(),
	exercises: [{ exerciseId: '0025', sets: 3, reps: 8, restSec: 90 }]
};

test('summary load: sets today and weekly sets against the aim', async ({ page }) => {
	await seedLocalStorage(page, { 'repdraft:sessions': SESSIONS, 'repdraft:plans': [PLAN] });
	await gotoApp(page, '/workouts/summary?id=today');

	const panel = page.locator('.summary-load');
	await expect(panel).toContainText('Подходы сегодня');
	await expect(panel).toContainText('Подходы за неделю');
	await expect(panel).toContainText('Цель 10+ на группу');

	// Today counts completed sets per catalog zone (calves would join legs).
	const todayChest = panel.locator('.summary-load__row', { hasText: 'Грудь' }).first();
	await expect(todayChest).toContainText('4');

	// The week is measured against an absolute aim, not a share of the session.
	await expect(panel.locator('.summary-load__row', { hasText: 'Руки' }).last()).toContainText(
		'2 / 10'
	);
	await expect(panel.locator('.summary-load__row', { hasText: 'Ноги' }).last()).toContainText(
		'5 / 10'
	);
});

test('summary load: a group under the aim adds an exercise to the plan', async ({ page }) => {
	await seedLocalStorage(page, { 'repdraft:sessions': SESSIONS, 'repdraft:plans': [PLAN] });
	await gotoApp(page, '/workouts/summary?id=today');

	const arms = page.locator('.summary-load__row--action', { hasText: 'Руки' });
	await expect(arms).toHaveAttribute('aria-label', 'Добавить «Руки» в план');
	await arms.click();
	// `/builder/:id` hands the plan to the builder and normalises the URL.
	await expect(page).toHaveURL(/\/builder$/);

	const plan = await page.evaluate(() => {
		const stored = JSON.parse(localStorage.getItem('repdraft:plans') ?? '[]');
		return stored.find((row: { id: string }) => row.id === 'p1');
	});
	// The picked arm exercise joined the plan (the chest exercise is still there).
	expect(plan.exercises.length).toBe(2);
});
