import { expect, test } from '@playwright/test';
import { gotoApp, seedLocalStorage } from '../helpers/app';

/**
 * The weight cue above the exercise is not a blind +2.5 kg any more: it estimates
 * the one-rep max from recent sets, names it, and snaps the next load to the
 * equipment's real step (2 kg for dumbbells, 2.5 kg for a barbell).
 *
 * Real catalog id 0285 is a dumbbell curl, so 62.5 kg would be advice the gym
 * cannot follow.
 */
const now = new Date().toISOString();
const plan = {
	id: 'plan-arms',
	name: 'E2E руки',
	createdAt: now,
	updatedAt: now,
	exercises: [{ exerciseId: '0285', sets: 3, reps: 8, restSec: 90 }]
};

function session(id: string, daysAgo: number, reps: readonly number[]) {
	const at = new Date(Date.now() - daysAgo * 86_400_000).toISOString();
	return {
		id,
		planId: 'plan-arms',
		planName: 'E2E руки',
		startedAt: at,
		finishedAt: at,
		exercises: [
			{
				exerciseId: '0285',
				targetSets: 3,
				targetReps: 8,
				restSec: 90,
				sets: reps.map((value) => ({
					weightKg: 60,
					reps: value,
					completed: true,
					kind: 'work'
				}))
			}
		]
	};
}

test('the weight hint is built from the estimated 1RM and the equipment step', async ({ page }) => {
	await seedLocalStorage(page, {
		'repdraft:plans': [plan],
		'repdraft:sessions': [session('w2', 1, [12, 12, 12]), session('w1', 8, [12, 12, 12])]
	});
	await gotoApp(page, '/live/plan-arms');

	// 60 kg × 12 reps estimates 84 kg; 12 reps at a plan of 8 earns more than one plate.
	await expect(page.locator('.live-weight-cue__max')).toContainText('1ПМ ≈ 84 кг');
	const hint = page.locator('.live-weight-cue__hint');
	await expect(hint).toContainText('66 кг × 8');
	await expect(hint).toContainText('79% от 1ПМ');
	// The advice is readable, not decoration hidden from screen readers.
	await expect(page.locator('.live-weight-cue')).not.toHaveAttribute('aria-hidden', 'true');
});

test('today\'s prescription wins over last session\'s reps', async ({ page }) => {
	const tens = {
		...plan,
		id: 'plan-arms-10',
		exercises: [{ exerciseId: '0285', sets: 3, reps: 10, restSec: 90 }]
	};
	await seedLocalStorage(page, {
		'repdraft:plans': [tens],
		'repdraft:sessions': [session('h1', 2, [8, 8, 8])]
	});
	await gotoApp(page, '/live/plan-arms-10');

	// 60 × 8 was a hit, but 10 reps at 60 is already at the estimate's edge: hold.
	const hint = page.locator('.live-weight-cue__hint');
	await expect(hint).toContainText('Повтори 60 кг × 10');
});

test('two misses in a row ease the load instead of repeating it forever', async ({ page }) => {
	await seedLocalStorage(page, {
		'repdraft:plans': [plan],
		'repdraft:sessions': [session('m2', 1, [6, 6, 5]), session('m1', 4, [7, 6, 6])]
	});
	await gotoApp(page, '/live/plan-arms');

	const hint = page.locator('.live-weight-cue__hint');
	await expect(hint).toContainText('Снизь до 58 кг × 8');
	await expect(hint).toContainText('% от 1ПМ');
});

test('a set taken to failure holds the load, and the EZ bar is part of the number', async ({
	page
}) => {
	const at = new Date().toISOString();
	const ezPlan = {
		id: 'plan-ez-curl',
		name: 'E2E EZ',
		createdAt: at,
		updatedAt: at,
		exercises: [{ exerciseId: '2404', sets: 3, reps: 8, restSec: 90 }]
	};
	const ezHistory = {
		id: 'session-ez-curl',
		planId: 'plan-ez-curl',
		planName: 'E2E EZ',
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
		'repdraft:sessions': [ezHistory]
	});
	await gotoApp(page, '/live/plan-ez-curl');

	const hint = page.locator('.live-weight-cue__hint');
	await expect(hint).toContainText('Держи 20 кг × 8');
	await expect(hint).toContainText('включая гриф 10 кг');
});
