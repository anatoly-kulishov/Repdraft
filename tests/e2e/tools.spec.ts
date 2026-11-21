import { expect, test } from '@playwright/test';
import { gotoApp } from '../helpers/app';

test.describe('calculators', () => {
	test('BMI: value, category, healthy range, empty input', async ({ page }) => {
		await gotoApp(page, '/tools/bmi');
		const inputs = page.locator('.tool-field input');
		const big = page.locator('.tool-big__value').first();

		await inputs.nth(0).fill('175');
		await inputs.nth(1).fill('70');
		await expect(big).toHaveText('22.9');
		await expect(page.locator('.tool-badge').first()).toHaveText('Норма');

		await inputs.nth(1).fill('95');
		await expect(big).toHaveText('31.0');

		const rows = await page.locator('.tool-row').allInnerTexts();
		expect(rows.some((row) => /57\s*[–-]\s*76/.test(row))).toBe(true);

		await inputs.nth(1).fill('');
		await expect(big).not.toContainText('NaN');
		await expect(big).not.toContainText('Infinity');
	});

	test('one-rep max: Epley / Brzycki / Lombardi, percent table, single rep', async ({
		page
	}) => {
		await gotoApp(page, '/tools/one-rep-max');
		const inputs = page.locator('.tool-field input');
		const big = page.locator('.tool-big__value').first();

		await inputs.nth(0).fill('100');
		await inputs.nth(1).fill('5');

		const epley = 100 * (1 + 5 / 30);
		const brzycki = (100 * 36) / (37 - 5);
		const lombardi = 100 * Math.pow(5, 0.1);
		const average = Math.round(((epley + brzycki + lombardi) / 3) * 10) / 10;

		await expect(big).toHaveText(String(average));

		const rows = await page.locator('.tool-row').allInnerTexts();
		expect(rows.some((row) => row.startsWith('Эпли') && row.includes(String(Math.round(epley * 10) / 10)))).toBe(true);
		expect(rows.some((row) => row.startsWith('70%') && row.includes(String(Math.round(average * 0.7 * 10) / 10)))).toBe(true);
		expect(rows.filter((row) => /^\d{2}%/.test(row))).toHaveLength(6);

		// Documented nuance: averaging Epley/Brzycki/Lombardi overshoots a true single
		// (100 × 1 -> 101.1); the BI methods disagree at 1 rep and we keep the average.
		await inputs.nth(1).fill('1');
		await expect(big).toHaveText('101.1');
	});

	test('calories: BMR, activity, goal, sex and macros', async ({ page }) => {
		await gotoApp(page, '/tools/calories');
		const inputs = page.locator('.tool-field input');
		const big = page.locator('.tool-big__value').first();

		await inputs.nth(0).fill('30');
		await inputs.nth(1).fill('180');
		await inputs.nth(2).fill('80');
		await page.getByRole('button', { name: 'Мужской', exact: true }).click();
		await page.getByRole('button', { name: '3–4 тренировки в неделю', exact: true }).click();
		await page.getByRole('button', { name: 'Поддержание', exact: true }).click();

		const bmrMale = 10 * 80 + 6.25 * 180 - 5 * 30 + 5; // 1780
		const tdee = Math.round(bmrMale * 1.55);
		await expect(big).toHaveText(String(tdee));

		const rows = await page.locator('.tool-row').allInnerTexts();
		expect(rows.some((row) => row.includes(String(Math.round(bmrMale))))).toBe(true);

		await page.getByRole('button', { name: 'Похудение', exact: true }).click();
		await expect(big).toHaveText(String(Math.round(bmrMale * 1.55 * 0.85)));

		await page.getByRole('button', { name: 'Женский', exact: true }).click();
		const bmrFemale = 10 * 80 + 6.25 * 180 - 5 * 30 - 161;
		await expect(big).toHaveText(String(Math.round(bmrFemale * 1.55 * 0.85)));

		const macroRows = await page.locator('.tool-row').allInnerTexts();
		expect(['Белки', 'Жиры', 'Углеводы'].every((name) => macroRows.some((row) => row.startsWith(name)))).toBe(true);
	});

	test('heart rate: Tanaka max, five zones, Karvonen when resting pulse is set', async ({
		page
	}) => {
		await gotoApp(page, '/tools/heart-rate-zones');
		const inputs = page.locator('.tool-field input');
		const big = page.locator('.tool-big__value').first();

		await inputs.nth(0).fill('30');
		const max = Math.round(208 - 0.7 * 30);
		await expect(big).toHaveText(String(max));
		expect(await page.locator('.tool-zone').count()).toBeGreaterThanOrEqual(5);

		await inputs.nth(1).fill('60');
		await expect(page.locator('.tool-badge').first()).toHaveText('По резерву пульса (Карвонен)');
		await expect(big).toHaveText(String(max));
	});

	test('EN mirror shows English calculator copy and the same math', async ({ page }) => {
		await gotoApp(page, '/en/tools/bmi');
		await expect(page.locator('html')).toHaveAttribute('lang', 'en');
		const inputs = page.locator('.tool-field input');
		await inputs.nth(0).fill('175');
		await inputs.nth(1).fill('70');
		await expect(page.locator('.tool-big__value').first()).toHaveText('22.9');

		const text = await page.locator('body').innerText();
		expect(text).not.toMatch(/\b(?:ИМТ|Вес|Рост|Норма)\b/);
	});

	test('age asks instead of pretending: empty field, 30 as the placeholder', async ({ page }) => {
		await gotoApp(page, '/tools/calories');
		const age = page.locator('.tool-field input').first();
		// Age is not in the athlete profile, so a prefilled 30 read as the user's own data.
		await expect(age).toHaveValue('');
		await expect(age).toHaveAttribute('placeholder', '30');
		// An untouched field still needs a number for the formula.
		await expect(page.locator('.tool-big__value').first()).toHaveText(/^\d+$/);

		await gotoApp(page, '/tools/heart-rate-zones');
		const hrAge = page.locator('.tool-field input').first();
		await expect(hrAge).toHaveValue('');
		await expect(hrAge).toHaveAttribute('placeholder', '30');
	});

	test('calculators never persist anything locally', async ({ page }) => {
		await gotoApp(page, '/tools/calories');
		const before = await page.evaluate(() =>
			Object.keys(localStorage).filter((key) => key.startsWith('repdraft:')).sort()
		);
		await page.locator('.tool-field input').nth(2).fill('90');
		await page.waitForTimeout(300);
		const after = await page.evaluate(() =>
			Object.keys(localStorage).filter((key) => key.startsWith('repdraft:')).sort()
		);
		expect(after).toEqual(before);
	});
});
