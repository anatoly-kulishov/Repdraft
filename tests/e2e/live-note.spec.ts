import { expect, test } from '@playwright/test';
import { gotoApp, seedLocalStorage } from '../helpers/app';

const PLAN = {
	id: 'plan-note',
	name: 'E2E заметка',
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:00:00.000Z',
	exercises: [{ exerciseId: '0001', sets: 3, reps: 10, restSec: 90 }]
};

/**
 * A note is a text field, not a live log: typing must not rewrite the active
 * session on every character (the save cue then looks like a sync per key).
 */
test('typing a note does not persist the session on every character', async ({ page }) => {
	await page.addInitScript(() => {
		const original = Storage.prototype.setItem;
		(window as unknown as { __activeWrites: number }).__activeWrites = 0;
		Storage.prototype.setItem = function (key: string, value: string) {
			if (key === 'repdraft:active-session') {
				(window as unknown as { __activeWrites: number }).__activeWrites += 1;
			}
			return original.call(this, key, value);
		};
	});
	await seedLocalStorage(page, { 'repdraft:plans': [PLAN] });
	await gotoApp(page, '/live/plan-note');

	await page.locator('.live-panel-head__actions button').click();
	await page.locator('.live-actions-tile', { hasText: 'Заметка' }).click();

	const field = page.locator('.live-ex-note__field');
	await page.evaluate(() => {
		(window as unknown as { __activeWrites: number }).__activeWrites = 0;
	});
	await field.pressSequentially('В след раз можно с весом', { delay: 25 });

	const duringTyping = await page.evaluate(
		() => (window as unknown as { __activeWrites: number }).__activeWrites
	);
	expect(duringTyping).toBe(0);

	// Closing is the commit point: the note is written once, not per keystroke.
	await page.locator('.bottom-sheet button', { hasText: 'Готово' }).click();
	await expect
		.poll(() =>
			page.evaluate(() => (window as unknown as { __activeWrites: number }).__activeWrites)
		)
		.toBe(1);

	await page.reload({ waitUntil: 'load' });
	await expect(page.locator('.live-panel-note-preview')).toContainText(
		'В след раз можно с весом'
	);
});
