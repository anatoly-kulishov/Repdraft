import { expect, test } from '@playwright/test';
import { gotoApp, seedLocalStorage } from '../helpers/app';

/**
 * Replacing an exercise in a live session. The zone select is seeded with the
 * current exercise's zone («Руки»), so the smart list must show that whole zone:
 * three biceps subs, then triceps, not an endless wall of curls.
 */
const now = new Date().toISOString();
const plan = {
	id: 'plan-arms',
	name: 'нед. 1 · Грудь + Трицепс',
	createdAt: now,
	updatedAt: now,
	exercises: [{ exerciseId: '0285', sets: 3, reps: 10, restSec: 90 }]
};

test('a biceps swap also offers triceps from the same zone', async ({ page }) => {
	await seedLocalStorage(page, { 'repdraft:plans': [plan] });
	await gotoApp(page, '/live/plan-arms');

	await page.locator('.live-panel-head__actions button').first().click();
	await page.locator('.live-actions-tile').filter({ hasText: 'Заменить' }).first().click();

	const sheet = page.locator('.live-exercise-pick');
	await expect(sheet.getByText('Подойдёт на замену')).toBeVisible();
	await expect(page.locator('.live-exercise-pick__zone')).toHaveValue('part:upper arms');

	const rows = page.locator('.live-exercise-pick__row');
	const labels = await rows.allTextContents();
	const biceps = labels.filter((text) => text.includes('Бицепс')).length;
	const triceps = labels.filter((text) => text.includes('Трицепс')).length;

	expect(biceps).toBeGreaterThan(0);
	expect(triceps).toBeGreaterThan(0);
	// One muscle never eats the zone: the first three rows are the closest swaps.
	const firstTriceps = labels.findIndex((text) => text.includes('Трицепс'));
	expect(firstTriceps).toBeGreaterThan(0);
	expect(firstTriceps).toBeLessThanOrEqual(3);
	// Same zone outranks other zones at the head of the list.
	expect(labels.slice(0, firstTriceps + 3).join(' ')).not.toContain('Широчайшие');
});
