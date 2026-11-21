import { expect, test, type Page } from '@playwright/test';
import { gotoApp, seedLocalStorage } from '../helpers/app';

const card = (page: Page) => page.locator('.bottom-sheet__card');

/** Intake stepper: `/auth/training` -> Анкета -> step 3 (Рост и вес). */
async function openBodyStep(page: Page) {
	await seedLocalStorage(page, { 'repdraft.locale': 'ru' });
	await gotoApp(page, '/auth/training');
	await page.locator('.profile-settings-row', { hasText: 'Анкета' }).click();
	await expect(card(page)).toBeVisible();

	for (let step = 0; step < 2; step++) {
		await card(page).getByRole('button', { name: 'Далее', exact: true }).click();
	}
	await expect(page.locator('.intake-stepper__title')).toHaveText('Рост и вес');
}

test('intake fields use the app focus style, not the browser ring', async ({ page }) => {
	await openBodyStep(page);
	await page.locator('.intake-stepper__input').nth(1).click();

	const styles = await page.evaluate(() => {
		const read = (el: Element) => {
			const cs = getComputedStyle(el);
			return { outlineStyle: cs.outlineStyle, borderColor: cs.borderColor };
		};
		const inputs = document.querySelectorAll('.intake-stepper__input');
		return { focused: read(inputs[1]), resting: read(inputs[0]) };
	});

	// Accent border only: Safari's UA ring draws broken arcs on the 1rem radius.
	expect(styles.focused.outlineStyle).toBe('none');
	expect(styles.focused.borderColor).not.toBe(styles.resting.borderColor);
});

test('intake card stays above the keyboard and scrolls instead of clipping', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 664 });
	await openBodyStep(page);

	// iOS keeps the layout viewport and only reports the keyboard inset, so the
	// card has to lift itself. Values mirror an iPhone 13 keyboard (~336px).
	const keyboard = 336;
	await page.evaluate((inset) => {
		const root = document.documentElement;
		root.style.setProperty('--safe-top', '47px');
		root.style.setProperty('--vv-keyboard-inset', `${inset}px`);
	}, keyboard);

	await expect
		.poll(() =>
			card(page).evaluate((el, inset) => {
				const rect = el.getBoundingClientRect();
				return (
					rect.top >= 47 &&
					rect.bottom <= window.innerHeight - inset &&
					el.scrollHeight > el.clientHeight + 1
				);
			}, keyboard)
		)
		.toBe(true);

	// The CTA starts below the fold of the shrunken card, scrolling reaches it.
	const cta = card(page).getByRole('button', { name: 'Далее', exact: true });
	await card(page).evaluate((el) => {
		el.scrollTop = el.scrollHeight;
	});
	await expect(cta).toBeInViewport();
});
