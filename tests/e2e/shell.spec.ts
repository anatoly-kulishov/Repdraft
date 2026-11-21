import { expect, test, type Page } from '@playwright/test';
import { gotoApp } from '../helpers/app';

const footer = (page: Page) => page.locator('nav.legal-footer');

test('legal footer links app tabs to public content', async ({ page }) => {
	await gotoApp(page, '/');
	await expect(footer(page)).toBeVisible();

	await expect(footer(page).getByRole('link', { name: 'Инструменты', exact: true })).toHaveAttribute(
		'href',
		'/tools'
	);
	await expect(footer(page).getByRole('link', { name: 'Программы', exact: true })).toHaveAttribute(
		'href',
		'/programs'
	);
	await expect(footer(page).getByRole('link', { name: 'Справочник', exact: true })).toHaveAttribute(
		'href',
		'/articles'
	);
	await expect(footer(page).getByRole('link', { name: 'Реквизиты', exact: true })).toHaveAttribute(
		'href',
		'/legal/requisites'
	);
});

test('public content keeps the footer, immersive flows drop it', async ({ page }) => {
	await gotoApp(page, '/tools');
	await expect(footer(page)).toBeVisible();

	await gotoApp(page, '/exercise/0001');
	await expect(footer(page)).toBeVisible();

	for (const path of ['/auth', '/builder']) {
		await gotoApp(page, path);
		await expect(footer(page)).toHaveCount(0);
	}
});

test('EN mirror footer points at EN paths', async ({ page }) => {
	await gotoApp(page, '/en/tools');
	await expect(footer(page)).toBeVisible();
	await expect(footer(page).getByRole('link', { name: 'Tools', exact: true })).toHaveAttribute(
		'href',
		'/en/tools'
	);
	await expect(footer(page).getByRole('link', { name: 'Programs', exact: true })).toHaveAttribute(
		'href',
		'/en/programs'
	);
});
