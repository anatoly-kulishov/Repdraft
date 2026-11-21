import { expect, test } from '@playwright/test';
import {
	finishLiveSession,
	gotoApp,
	rateFinishedSession,
	seedLocalStorage
} from '../helpers/app';

function readPlansFromStorage(raw: string | null): Record<string, unknown>[] {
	if (!raw) return [];
	const parsed = JSON.parse(raw) as unknown;
	if (Array.isArray(parsed)) return parsed as Record<string, unknown>[];
	const withPlans = parsed as { plans?: Record<string, unknown>[] };
	return withPlans.plans ?? [];
}

test.describe('program library', () => {
	test('hub lists both four-week templates', async ({ page }) => {
		await gotoApp(page, '/programs');
		await expect(page.locator('h1')).toContainText('Программы');
		await expect(page.locator('.program-card')).toHaveCount(2);
		await expect(page.locator('.program-card__title')).toContainText([
			'Всё тело 3 раза в неделю',
			'Верх / низ 4 раза в неделю'
		]);
	});

	test('cards carry the facts a block needs: frequency, time and kit', async ({ page }) => {
		await gotoApp(page, '/programs');
		const first = page.locator('.program-card').first();
		await expect(first.locator('.program-card__meta')).toContainText('3 тренировки в неделю');
		await expect(first.locator('.program-card__meta')).toContainText('мин');
		await expect(first.locator('.program-kit__item')).toContainText([
			'Штанга',
			'Гантели',
			'Свой вес'
		]);

		await gotoApp(page, '/programs/upper-lower-4x');
		await expect(page.locator('.program-head')).toContainText('4 тренировки в неделю');
		await expect(page.locator('.program-head .program-kit__item')).toHaveCount(3);
	});

	test('save for later floats the block up and survives a reload', async ({ page }) => {
		await gotoApp(page, '/programs');
		const second = page.locator('.program-card').nth(1);
		await expect(second.locator('.program-card__title')).toContainText('Верх / низ');

		const save = second.locator('.program-card__save');
		await expect(save).toHaveAttribute('aria-pressed', 'false');
		await save.click();
		// Saving floats the card to the top, so re-query instead of reusing `second`.
		const savedCard = page.locator('.program-card').first();
		await expect(savedCard.locator('.program-card__title')).toContainText('Верх / низ');
		await expect(savedCard.locator('.program-card__save')).toHaveAttribute('aria-pressed', 'true');

		const saved = await page.evaluate(() => localStorage.getItem('repdraft:saved-programs'));
		expect(saved).toContain('upper-lower-4x');

		await page.reload({ waitUntil: 'load' });
		await expect(page.locator('.program-card__title').first()).toContainText('Верх / низ');
		await expect(page.locator('.program-card').first().locator('.program-card__save')).toHaveAttribute(
			'aria-pressed',
			'true'
		);
	});

	test('detail lists the full wave: 12 sessions / 4 weeks', async ({ page }) => {
		await gotoApp(page, '/programs/full-body-3x');
		await expect(page.locator('.program-week')).toHaveCount(4);
		await expect(page.locator('.program-session')).toHaveCount(12);
		await expect(page.locator('.program-week').first()).toContainText('Неделя 1');
	});

	test('start a program slot, finish it, keep the run and share it with the EN mirror', async ({
		page
	}) => {
		await gotoApp(page, '/programs/full-body-3x');
		await page.locator('.program-session button', { hasText: 'Начать' }).first().click();
		await expect(page).toHaveURL(/\/live\//, { timeout: 30_000 });

		// Program plans are normal local plans with a short, readable name.
		const plans = readPlansFromStorage(await page.evaluate(() => localStorage.getItem('repdraft:plans')));
		expect(plans).toHaveLength(1);
		const plan = plans[0] as { name: string; exercises: { exerciseId?: string; id?: string }[] };
		expect(plan.name.length).toBeLessThanOrEqual(48);
		expect(plan.name).not.toMatch(/…|\.\.\.$/);
		expect(plan.name).toMatch(/^Всё тело 3× · нед\. 1/);
		const ids = plan.exercises.map((exercise) => exercise.exerciseId ?? exercise.id);
		expect(new Set(ids).size).toBeGreaterThanOrEqual(3);

		await finishLiveSession(page);
		await rateFinishedSession(page, 5);

		const ratings = await page.evaluate(() => localStorage.getItem('repdraft:session-ratings'));
		expect(ratings).toContain('"stars":5');

		await gotoApp(page, '/programs/full-body-3x');
		await expect(page.locator('.program-progress__row').first()).toContainText('Пройдено 1 из 12');
		await expect(page.locator('.program-session.is-done')).toHaveCount(1);
		await expect(page.locator('.program-session.is-done')).toContainText('Готово');

		await gotoApp(page, '/en/programs/full-body-3x');
		await expect(page.locator('.program-progress__row').first()).toContainText('Done 1 of 12');
		await expect(page.locator('.program-session.is-done')).toHaveCount(1);
	});

	test('progress hydrates on the client; SSR stays at zero (no hydration mismatch)', async ({
		page,
		request
	}) => {
		await seedLocalStorage(page, {
			'repdraft:program-runs': [
				{
					slug: 'full-body-3x',
					startedAt: '2026-11-01T10:00:00.000Z',
					slots: {
						'1:a': {
							planId: 'seed-plan',
							startedAt: '2026-11-01T10:00:00.000Z',
							completedAt: '2026-11-01T11:00:00.000Z'
						}
					}
				}
			]
		});

		const ssr = await request.get('/programs/full-body-3x');
		expect(ssr.status()).toBe(200);
		expect(await ssr.text()).toContain('Пройдено 0 из 12');

		await gotoApp(page, '/programs/full-body-3x');
		await expect(page.locator('.program-progress__row').first()).toContainText('Пройдено 1 из 12');
		await expect(page.locator('.program-session.is-done')).toHaveCount(1);
	});
});
