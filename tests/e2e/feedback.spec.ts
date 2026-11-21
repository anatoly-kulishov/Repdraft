import { expect, test } from '@playwright/test';
import { gotoApp } from '../helpers/app';

test('feedback: empty and tiny messages never reach the API', async ({ page }) => {
	let posted = 0;
	await page.route('**/api/feedback', async (route) => {
		posted += 1;
		await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
	});

	await gotoApp(page, '/feedback');
	await expect(page.getByRole('heading', { name: 'Обратная связь', level: 1 })).toBeVisible();

	await page.getByRole('button', { name: 'Отправить' }).click();
	await expect(page.locator('.feedback-error')).toHaveText('Напишите сообщение');

	await page.locator('#feedback-message').fill('ой');
	await page.getByRole('button', { name: 'Отправить' }).click();
	await expect(page.locator('.feedback-error')).toContainText('Слишком коротко');
	expect(posted).toBe(0);
});

test('feedback: a valid message is posted with its kind and reply email', async ({ page }) => {
	type Payload = { kind?: string; message?: string; email?: string; page?: string; website?: string };
	let payloadJson: string | null = null;

	await page.route('**/api/feedback', async (route) => {
		payloadJson = route.request().postData();
		await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
	});

	await gotoApp(page, '/feedback');
	await page.getByRole('button', { name: 'Предложение' }).click();
	await page
		.locator('#feedback-message')
		.fill('Хочу видеть график объёма по неделям прямо в истории тренировок');
	await page.locator('#feedback-email').fill('athlete@example.com');
	await page.getByRole('button', { name: 'Отправить' }).click();

	await expect(page.locator('.feedback-sent')).toContainText('Сообщение отправлено');
	const payload = JSON.parse(payloadJson ?? '{}') as Payload;
	expect(payload.kind).toBe('idea');
	expect(payload.email).toBe('athlete@example.com');
	expect(payload.page).toBe('/feedback');
	expect(payload.message).toContain('график объёма');
	// Honeypot travels empty: a filled one must be the only reason the server drops it.
	expect(payload.website).toBe('');

	await page.getByRole('button', { name: 'Отправить ещё одно' }).click();
	await expect(page.locator('.feedback-form')).toBeVisible();
	await expect(page.locator('#feedback-message')).toHaveValue('');
});

test('feedback: an unconfigured mail server points at the fallback address', async ({ page }) => {
	await page.route('**/api/feedback', async (route) => {
		await route.fulfill({
			status: 503,
			contentType: 'application/json',
			body: JSON.stringify({
				ok: false,
				error: 'feedback.unavailable',
				email: 'dev@example.com'
			})
		});
	});

	await gotoApp(page, '/feedback');
	await page.locator('#feedback-message').fill('Кнопка старта не реагирует на Android');
	await page.getByRole('button', { name: 'Отправить' }).click();

	await expect(page.locator('.feedback-error')).toContainText('dev@example.com');
	await expect(page.locator('.feedback-form')).toBeVisible();
});
