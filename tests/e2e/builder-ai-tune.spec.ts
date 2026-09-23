import { test, expect } from '@playwright/test';
import { gotoReady, seedGuestStorage, waitAppReady } from './helpers/app-ready';
import { builderNameInput } from './helpers/flow-locators';

test.beforeEach(async ({ page }) => {
	await seedGuestStorage(page);
	page.on('dialog', (d) => d.accept());
});

async function addFirstExercise(page: import('@playwright/test').Page) {
	await gotoReady(page, '/builder?new');
	const nameInput = builderNameInput(page);
	await nameInput.waitFor({ state: 'visible', timeout: 10_000 });
	await nameInput.fill(`AI tune ${Date.now().toString(36).slice(-4)}`);

	const pickFab = page.locator('.app-fab[href*="exercises"]').first();
	const pickLink = page.locator('a[href*="/exercises?from="]').first();
	if ((await pickFab.count()) > 0 && (await pickFab.isVisible())) {
		await pickFab.click();
	} else if ((await pickLink.count()) > 0 && (await pickLink.isVisible())) {
		await pickLink.click();
	} else {
		await page.goto('/exercises?from=%2Fbuilder');
	}
	await waitAppReady(page);

	if (page.url().includes('/exercises')) {
		await page.locator('a[href^="/catalog/"]').first().click();
		await waitAppReady(page);
		const browseAll = page.locator('a[href*="browse=all"]').first();
		if ((await browseAll.count()) > 0 && (await browseAll.isVisible())) {
			await browseAll.click();
			await waitAppReady(page);
		}
	}

	const addBtn = page.locator('.exercise-card-add').first();
	await addBtn.waitFor({ state: 'visible', timeout: 15_000 });
	await addBtn.click();
	await waitAppReady(page);
	if (!page.url().includes('/builder')) {
		await gotoReady(page, '/builder');
	}
	await page.locator('.workout-ex-head').first().waitFor({ state: 'visible', timeout: 10_000 });
}

test('builder: AI tune menu → goals → suggest → apply', async ({ page, request }, testInfo) => {
	test.setTimeout(120_000);

	const avail = await request.get('/api/ai/plan');
	const availJson = (await avail.json()) as { available?: boolean };
	test.skip(!availJson.available, 'AI provider not configured');

	await addFirstExercise(page);

	await page.getByRole('button', { name: /^(Действия упражнения|Exercise actions)$/ }).first().click();
	const aiItem = page.locator('button.builder-ex-action').filter({ hasText: /Подобрать с ИИ|Tune with AI/i });
	await expect(aiItem).toBeVisible({ timeout: 5_000 });
	await aiItem.click();

	const sheet = page.locator('.bottom-sheet').filter({ hasText: /Подбор нагрузки|Tune prescription/i });
	await expect(sheet).toBeVisible();

	const note = sheet.locator('textarea').first();
	await expect(note).toBeVisible();
	const hypertrophyHint = await note.inputValue();
	expect(hypertrophyHint.length).toBeGreaterThan(5);

	await sheet.getByRole('button', { name: /^(Сила|Strength)$/ }).click();
	await expect(note).toHaveValue(/Меньше повторов|Fewer reps/);

	await note.fill('Кастомный текст не должен смениться');
	await sheet.getByRole('button', { name: /^(Масса|Hypertrophy)$/ }).click();
	await expect(note).toHaveValue('Кастомный текст не должен смениться');

	await sheet.getByRole('button', { name: /^(Сила|Strength)$/ }).click();
	await note.fill('');
	await sheet.getByRole('button', { name: /^(Выносливость|Endurance)$/ }).click();
	await expect(note).toHaveValue(/Больше повторов|More reps/);

	await sheet.getByRole('button', { name: /^(Подобрать|Suggest)$/ }).click();
	await expect(sheet.getByRole('button', { name: /^(Применить|Apply)$/ })).toBeVisible({
		timeout: 60_000
	});

	const resultLine = sheet.locator('.builder-ai-tune__numbers');
	await expect(resultLine).toBeVisible();
	const resultText = (await resultLine.innerText()).replace(/\s+/g, ' ');
	const m = resultText.match(/(\d+)\s*[×x]\s*(\d+).*?(\d+)\s*s/i);
	expect(m, `result «${resultText}»`).toBeTruthy();
	const sets = Number(m![1]);
	const reps = Number(m![2]);
	const rest = Number(m![3]);
	// Endurance band
	expect(reps).toBeGreaterThanOrEqual(12);
	expect(rest).toBeLessThanOrEqual(75);

	await sheet.getByRole('button', { name: /^(Применить|Apply)$/ }).click();
	await expect(page.locator('.bottom-sheet')).toHaveCount(0);

	const setsInput = page.locator('.workout-ex-chip').filter({ hasText: /Подходы|Sets/i }).locator('input').first();
	const repsInput = page.locator('.workout-ex-chip').filter({ hasText: /Повторы|Reps/i }).locator('input').first();
	const restInput = page.locator('.workout-ex-chip').filter({ hasText: /Отдых|Rest/i }).locator('input').first();
	await expect(setsInput).toHaveValue(String(sets), { timeout: 5_000 });
	await expect(repsInput).toHaveValue(String(reps));
	await expect(restInput).toHaveValue(String(rest));

	// Sticky: menu still lists AI after apply
	await page.getByRole('button', { name: /^(Действия упражнения|Exercise actions)$/ }).first().click();
	await expect(
		page.locator('button.builder-ex-action').filter({ hasText: /Подобрать с ИИ|Tune with AI/i })
	).toBeVisible();

	void testInfo;
});

test('builder: AI tune after ladder clears ladder chip', async ({ page, request }) => {
	test.setTimeout(120_000);
	const avail = await request.get('/api/ai/plan');
	const availJson = (await avail.json()) as { available?: boolean };
	test.skip(!availJson.available, 'AI provider not configured');

	await addFirstExercise(page);

	await page.getByRole('button', { name: /^(Действия упражнения|Exercise actions)$/ }).first().click();
	await page.locator('button.builder-ex-action').filter({ hasText: /Лесенка|Ladder/i }).click();
	const ladderSheet = page.locator('.bottom-sheet').filter({ hasText: /Лесенка повторов|Rep ladder/i });
	await expect(ladderSheet).toBeVisible();
	await ladderSheet.locator('input').nth(0).fill('5');
	await ladderSheet.locator('input').nth(1).fill('1');
	await ladderSheet.getByRole('button', { name: /^(Применить|Apply)$/ }).click();
	await expect(page.locator('.workout-ex-chip--ladder').first()).toBeVisible();

	await page.getByRole('button', { name: /^(Действия упражнения|Exercise actions)$/ }).first().click();
	await page.locator('button.builder-ex-action').filter({ hasText: /Подобрать с ИИ|Tune with AI/i }).click();
	const tuneSheet = page.locator('.bottom-sheet').filter({ hasText: /Подбор нагрузки|Tune prescription/i });
	await tuneSheet.getByRole('button', { name: /^(Масса|Hypertrophy)$/ }).click();
	await tuneSheet.getByRole('button', { name: /^(Подобрать|Suggest)$/ }).click();
	await expect(tuneSheet.getByRole('button', { name: /^(Применить|Apply)$/ })).toBeVisible({
		timeout: 60_000
	});
	await tuneSheet.getByRole('button', { name: /^(Применить|Apply)$/ }).click();
	await expect(page.locator('.workout-ex-chip--ladder')).toHaveCount(0);
});
