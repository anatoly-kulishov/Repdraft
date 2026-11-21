import { expect, test } from '@playwright/test';
import { gotoApp, seedLocalStorage } from '../helpers/app';

/** Real catalog ids: 0043 quads, 0999 calves, 0025 chest, 0007 back, 0968 arms. */
const DAY: readonly [string, number][] = [
	['0043', 5],
	['0999', 3],
	['0025', 4],
	['0007', 4],
	['0968', 2]
];

function session(id: string, daysAgo: number, exercises: readonly [string, number][]) {
	const start = new Date(Date.now() - daysAgo * 86_400_000);
	start.setUTCHours(9, 0, 0, 0);
	const finish = new Date(start.getTime() + 70 * 60_000);
	return {
		id,
		planId: null,
		planName: `E2E ${id}`,
		startedAt: start.toISOString(),
		finishedAt: finish.toISOString(),
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

const SESSIONS = [3, 2, 1, 0].map((daysAgo, i) => session(`p${i + 1}`, daysAgo, DAY));

test('muscle shares speak catalog zones: calves count as legs, neutral smallest badge', async ({
	page
}) => {
	await seedLocalStorage(page, { 'repdraft:sessions': SESSIONS });
	await gotoApp(page, '/progress');

	const parts = page.locator('.progress-part__label');
	await expect(parts.filter({ hasText: 'Ноги' })).toHaveCount(1);
	// «Голени» is part of «Ноги» in the catalog hub, so shares must not split it out.
	await expect(parts.filter({ hasText: 'Голени' })).toHaveCount(0);

	// Legs dominate the set count; arms really are short and own the badge.
	await expect(page.locator('.progress-part').first()).toContainText('Ноги');
	await expect(page.locator('.progress-part__smallest')).toHaveCount(1);
	await expect(page.locator('.progress-part', { hasText: 'Меньше всего' })).toContainText('Руки');
});
