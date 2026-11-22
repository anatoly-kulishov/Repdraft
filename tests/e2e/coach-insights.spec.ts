import { expect, test } from '@playwright/test';
import { gotoApp, seedLocalStorage } from '../helpers/app';

/**
 * Deep coach cards: the screen has to name a concrete load, call out a volume
 * spike and offer a swap for an exercise that keeps being skipped. The same
 * history also drives the weekly-sets panel, so cards and panel agree.
 *
 * Real catalog ids: 0025 bench (chest), 0027 row (back), 0043 squat (legs),
 * 0294 dumbbell curl (upper arms).
 */
const DAY = 86_400_000;

function session(
	id: string,
	daysAgo: number,
	exerciseId: string,
	opts: { sets?: number; weightKg?: number; reps?: number; skipped?: boolean; empty?: boolean } = {}
) {
	const start = new Date(Date.now() - daysAgo * DAY);
	start.setUTCHours(9, 0, 0, 0);
	const finishedAt = new Date(start.getTime() + 60 * 60_000).toISOString();
	const count = opts.sets ?? 3;
	return {
		id,
		planId: 'coach-e2e',
		planName: 'E2E верх',
		startedAt: start.toISOString(),
		finishedAt,
		exercises: [
			{
				exerciseId,
				targetSets: 3,
				targetReps: 8,
				restSec: 90,
				skipped: opts.skipped,
				sets: opts.empty
					? []
					: Array.from({ length: count }, () => ({
							weightKg: opts.weightKg ?? 60,
							reps: opts.reps ?? 8,
							completed: true,
							kind: 'work'
						}))
			}
		]
	};
}

const SESSIONS = [
	// Current week: 24 working sets. Each earlier week: 6.
	session('s1', 1, '0043', { sets: 8, weightKg: 100, reps: 6 }),
	session('s2', 2, '0025', { sets: 8 }),
	session('s3', 3, '0025', { sets: 8 }),
	session('s4', 9, '0025', { sets: 6 }),
	session('s5', 16, '0025', { sets: 6 }),
	session('s6', 23, '0025', { sets: 6 }),
	// Curls: skipped, then left empty, then trained once.
	session('k1', 1, '0294', { weightKg: 12, reps: 10, skipped: true }),
	session('k2', 4, '0294', { weightKg: 12, reps: 10, empty: true }),
	session('k3', 9, '0294', { weightKg: 12, reps: 10 })
];

const PLAN = {
	id: 'coach-e2e',
	name: 'E2E верх',
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString(),
	exercises: [
		{ exerciseId: '0025', sets: 3, reps: 8, restSec: 120 },
		{ exerciseId: '0027', sets: 3, reps: 8, restSec: 120 },
		{ exerciseId: '0294', sets: 3, reps: 10, restSec: 60 }
	]
};

test('coach insights: weekly sets, next load, spike and a swap', async ({ page }) => {
	await seedLocalStorage(page, {
		'repdraft:sessions': SESSIONS,
		'repdraft:plans': [PLAN]
	});
	await gotoApp(page, '/coach');

	const balance = page.locator('.coach-balance');
	await expect(balance).toContainText('Подходы за неделю');
	await expect(balance).toContainText('ориентир 10+');
	await expect(balance.locator('.coach-balance__row', { hasText: 'Руки' })).toContainText('0');
	await expect(balance.locator('.coach-balance__row', { hasText: 'Ноги' })).toContainText('8');

	// Stalled bench at 60 kg x 8 five sessions in a row: the screen names the
	// next step from the 1RM engine instead of a blind +2.5 kg.
	const progress = page.locator('.coach-card', { hasText: 'Пора добавить вес' });
	await expect(progress).toContainText('Жим штанги лёжа');
	await expect(progress).toContainText('62.5 кг');

	const spike = page.locator('.coach-card', { hasText: 'Объём вырос резко' });
	await expect(spike).toContainText('24');
	await expect(spike).toContainText('за эту неделю');

	const skipped = page.locator('.coach-card', { hasText: 'Упражнение не идёт' });
	await expect(skipped).toContainText('Подъём гантелей на бицепс');
	await expect(skipped.getByRole('button', { name: 'Заменить' })).toBeVisible();

	// Hiding a card keeps it away for a week on this device.
	const before = await page.locator('.coach-card').count();
	await progress.getByRole('button', { name: 'Скрыть на 7 дней' }).click();
	await expect(page.locator('.coach-card')).toHaveCount(before - 1);
	const hidden = await page.evaluate(() => localStorage.getItem('repdraft:coach-hidden'));
	expect(hidden).toContain('0025');
});
