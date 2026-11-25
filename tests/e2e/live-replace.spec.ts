import { expect, test, type Locator, type Page } from '@playwright/test';
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

/** «Шраги с резинкой»: the band lift from the field report (band, band shrug). */
const backPlan = {
	id: 'plan-back',
	name: 'нед. 1 · Спина + Бицепс',
	createdAt: now,
	updatedAt: now,
	exercises: [
		{ exerciseId: '1018', sets: 3, reps: 12, restSec: 90 },
		{ exerciseId: '0095', sets: 3, reps: 12, restSec: 90 }
	]
};

async function openReplaceSheet(page: Page) {
	await page.locator('.live-panel-head__actions button').first().click();
	await page.locator('.live-actions-tile').filter({ hasText: 'Заменить' }).first().click();
	await expect(page.locator('.live-exercise-pick')).toBeVisible();
}

/** Real touch drag through the compositor (mouse.move would not scroll a touch UI). */
async function touchDrag(page: Page, target: Locator, opts: { dy: number; firstDx?: number }) {
	const box = await target.boundingBox();
	if (!box) throw new Error('touchDrag: no box');
	const cdp = await page.context().newCDPSession(page);
	const x = box.x + box.width / 2;
	let y = box.y + box.height / 2;
	const step = Math.sign(opts.dy) * 16;
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
	// First frame is slightly diagonal — exactly what a thumb does.
	await cdp.send('Input.dispatchTouchEvent', {
		type: 'touchMove',
		touchPoints: [{ x: x + (opts.firstDx ?? 0), y: y + Math.sign(opts.dy) * 2 }]
	});
	let moved = Math.sign(opts.dy) * 2;
	while (Math.abs(moved) < Math.abs(opts.dy)) {
		y += step;
		moved += step;
		await cdp.send('Input.dispatchTouchEvent', {
			type: 'touchMove',
			touchPoints: [{ x: x + (opts.firstDx ?? 0), y }]
		});
	}
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

test('a biceps swap also offers triceps from the same zone', async ({ page }) => {
	await seedLocalStorage(page, { 'repdraft:plans': [plan] });
	await gotoApp(page, '/live/plan-arms');
	await openReplaceSheet(page);

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

test('the substitute list scrolls by touch inside the sheet', async ({ page }) => {
	await seedLocalStorage(page, { 'repdraft:plans': [backPlan] });
	await gotoApp(page, '/live/plan-back');
	await openReplaceSheet(page);

	const list = page.locator('.live-exercise-pick__list');
	const scrollTop = () => list.evaluate((el) => el.scrollTop);
	const overflow = await list.evaluate((el) => el.scrollHeight - el.clientHeight);
	expect(overflow).toBeGreaterThan(200);

	// Slanted first frame: it used to hand the gesture to the horizontal branch,
	// whose preventDefault froze the pan for the rest of the swipe on iOS.
	await touchDrag(page, list, { dy: -160, firstDx: 8 });
	await expect.poll(scrollTop).toBeGreaterThan(20);

	// The card must not be a second same-axis scroller — iOS drags the wrong box.
	const card = page.locator('.bottom-sheet__card');
	const cardOverflow = await card.evaluate((el) => el.scrollHeight - el.clientHeight);
	expect(cardOverflow).toBeLessThanOrEqual(1);
	// CSS invariants of that fix (Chromium cannot reproduce the iOS symptom, but
	// it can catch a regression): one scroller, and no backdrop-filter layer on
	// the ancestor of that scroller — WebKit ignores pans inside a filtered card
	// until the content gets focus.
	await expect(card).toHaveCSS('overflow-y', 'hidden');
	await expect(card).toHaveCSS('backdrop-filter', 'none');
	const plateFilter = await card.evaluate(
		(el) => getComputedStyle(el, '::before').backdropFilter
	);
	expect(plateFilter).not.toBe('none');
});

test('no two substitute rows are the same movement, and today’s lifts are skipped', async ({
	page
}) => {
	await seedLocalStorage(page, { 'repdraft:plans': [backPlan] });
	await gotoApp(page, '/live/plan-back');
	await openReplaceSheet(page);

	const names = await page.locator('.live-exercise-pick__name').allTextContents();
	// Catalog duplicates («Шраги вниз головой с гантелями» + «(вариант 2)») must
	// not eat two rows of the first screen.
	const families = names.map((name) =>
		name.replace(/\((?:вариант \d+|другой ракурс)\)/gi, ' ').replace(/\s+/g, ' ').trim()
	);
	expect(new Set(families).size).toBe(families.length);
	// «Шраги со штангой» is already scheduled in this workout.
	expect(names.join(' ')).not.toContain('Шраги со штангой');
});
