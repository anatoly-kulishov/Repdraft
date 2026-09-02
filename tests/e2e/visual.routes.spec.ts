import { test, expect } from '@playwright/test';
import { gotoReady, seedGuestStorage, stabilizeChrome, waitAppReady } from './helpers/app-ready';

const ROUTES: { id: string; path: string; ready?: string }[] = [
	{ id: 'home', path: '/', ready: '.home-page, .home-header, .home-guest-create' },
	{ id: 'workouts', path: '/workouts', ready: '.workouts-page' },
	{ id: 'exercises-hub', path: '/exercises', ready: '.catalog-hub' },
	{ id: 'catalog-chest', path: '/catalog/chest?target=pectorals', ready: '.catalog-zone, .exercise-card' },
	{ id: 'records', path: '/exercises/records', ready: '.page-title, .content-page' },
	{ id: 'saved', path: '/exercises/saved', ready: '.content-page, .page-title' },
	{ id: 'builder-empty', path: '/builder?new', ready: '.builder-page, .builder-empty-state, .page-title' },
	{ id: 'settings', path: '/settings', ready: '.content-page, .page-title' },
	{ id: 'auth', path: '/auth', ready: '.auth-page, form' }
];

test.beforeEach(async ({ page }) => {
	await seedGuestStorage(page);
});

for (const route of ROUTES) {
	test(`screen: ${route.id}`, async ({ page }, testInfo) => {
		await gotoReady(page, route.path);
		if (route.ready) {
			await page.locator(route.ready).first().waitFor({ state: 'visible', timeout: 15_000 });
		}
		await stabilizeChrome(page);
		await expect(page).toHaveScreenshot(`${route.id}.png`, {
			fullPage: false,
			mask: [page.locator('.shell-nav-tabbar'), page.locator('#pwa-boot')]
		});
	});
}

test('screen: exercise-detail', async ({ page }) => {
	await seedGuestStorage(page);
	const indexRes = await page.request.get('/data/exercises.index.json');
	const index = (await indexRes.json()) as { id: string; body_part: string }[];
	const chest = index.find((ex) => ex.body_part === 'chest');
	test.skip(!chest?.id, 'no chest exercise in index');
	await gotoReady(page, `/exercise/${chest!.id}`);
	await page.locator('.exercise-detail-page, .content-page--exercise').first().waitFor({
		state: 'visible',
		timeout: 15_000
	});
	await stabilizeChrome(page);
	await expect(page).toHaveScreenshot('exercise-detail.png', { fullPage: false });
});

test('screen: theme-light', async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('repdraft.theme', 'light');
	});
	await gotoReady(page, '/workouts');
	await page.locator('.workouts-page').waitFor({ state: 'visible' });
	await stabilizeChrome(page);
	await expect(page).toHaveScreenshot('workouts-light.png', { fullPage: false });
});
