import { expect, test } from '@playwright/test';
import { gotoApp } from '../helpers/app';

test.describe('builder quick pick', () => {
	test('equipment -> muscles -> exercises lands in the draft', async ({ page }) => {
		await gotoApp(page, '/builder?new=1');
		await page.getByRole('link', { name: 'Подобрать по оборудованию' }).click();
		await expect(page).toHaveURL(/\/builder\/equipment$/);

		// Step 1: kit. Bodyweight is offered first and can stay unselected.
		await expect(page.getByRole('heading', { name: 'Что есть под рукой' })).toBeVisible();
		const dumbbells = page.locator('.builder-pick__chips button', { hasText: 'Гантели' }).first();
		await expect(dumbbells).toHaveAttribute('aria-pressed', 'false');
		await dumbbells.click();
		await expect(dumbbells).toHaveAttribute('aria-pressed', 'true');

		await page.getByRole('button', { name: 'Дальше' }).click();

		// Step 2: muscles. "Ноги" is the merged upper/lower legs zone.
		await expect(page.getByRole('heading', { name: 'Какие мышцы тренируем' })).toBeVisible();
		const chest = page.locator('.builder-pick__zone', { hasText: 'Грудь' }).first();
		await chest.click();
		await expect(chest).toHaveAttribute('aria-pressed', 'true');

		await page.getByRole('button', { name: 'Дальше' }).click();

		// Step 3: a popularity-first list with one-tap add to the draft.
		await expect(page.getByRole('heading', { name: 'Упражнения под ваш набор' })).toBeVisible();
		await expect(page.locator('.builder-pick__summary')).toContainText('Гантели');
		await expect(page.locator('.builder-pick__summary')).toContainText('Грудь');

		const rows = page.locator('.builder-pick__list .exercise-card');
		const count = await rows.count();
		expect(count).toBeGreaterThan(0);

		await rows.first().getByRole('button', { name: 'Добавить в план' }).click();
		await expect(rows.first().getByRole('button', { name: 'Убрать из плана' })).toBeVisible();

		await page.getByRole('button', { name: 'Готово' }).click();
		await expect(page).toHaveURL(/\/builder$/);
		await expect(page.locator('.workout-ex-row')).toHaveCount(1);

		const draft = await page.evaluate(() => localStorage.getItem('repdraft:draft'));
		expect(draft).toBeTruthy();
		expect(JSON.parse(draft ?? '{}').exercises).toHaveLength(1);
	});

	test('bodyweight stays available even with a one-item kit', async ({ page }) => {
		await gotoApp(page, '/builder/equipment');
		await page.locator('.builder-pick__chips button', { hasText: 'Свой вес' }).first().click();
		await page.getByRole('button', { name: 'Дальше' }).click();
		// Neck has bodyweight-only movements: the fallback must not vanish.
		await page.locator('.builder-pick__zone', { hasText: 'Шея' }).first().click();
		await page.getByRole('button', { name: 'Дальше' }).click();

		await expect(page.locator('.builder-pick__summary')).toContainText('Свой вес');
		await expect(page.locator('.builder-pick__summary')).toContainText('Шея');
		await expect(page.locator('.builder-pick__list .exercise-card')).toHaveCount(2);
	});
});
