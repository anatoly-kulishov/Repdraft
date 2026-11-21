import { expect, test } from '@playwright/test';

test.describe('API and error surfaces', () => {
	test('unknown routes return a real 404 with noindex', async ({ request }) => {
		for (const path of ['/definitely-not-a-page', '/en/definitely-not-a-page']) {
			const response = await request.get(path);
			expect(response.status(), `${path} status`).toBe(404);
			expect(await response.text(), `${path} robots`).toContain('noindex');
		}
	});

	test('dev-only lab route is not shipped to production', async ({ request }) => {
		const response = await request.get('/lab/fx');
		expect(response.status()).toBe(404);
	});

	test('public catalog API returns an exercise and 404s on an unknown id', async ({
		request
	}) => {
		const found = await request.get('/api/catalog/exercise/0001');
		expect(found.status()).toBe(200);
		const body = (await found.json()) as { id: string; instruction_steps: unknown };
		expect(body.id).toBe('0001');
		expect(body.instruction_steps).toBeTruthy();

		const missing = await request.get('/api/catalog/exercise/nope');
		expect(missing.status()).toBe(404);
	});

	test('AI and billing endpoints fail closed for a guest instead of 500', async ({
		request
	}) => {
		const aiStatus = await request.get('/api/ai/plan');
		expect([200, 503]).toContain(aiStatus.status());
		const aiBody = (await aiStatus.json()) as { available?: boolean };
		if (aiStatus.status() === 503) expect(aiBody.available).toBe(false);

		const invalidBrief = await request.post('/api/ai/plan', {
			data: '{not json',
			headers: { 'content-type': 'application/json' }
		});
		expect(invalidBrief.status()).toBe(400);

		const billing = await request.get('/api/billing/status');
		expect([401, 503]).toContain(billing.status());
		const billingBody = (await billing.json()) as { error?: string };
		expect(billingBody.error).toBeTruthy();
	});
});
