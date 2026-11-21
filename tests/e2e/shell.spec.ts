import { expect, test, type Page } from '@playwright/test';
import { gotoApp } from '../helpers/app';

const footer = (page: Page) => page.locator('nav.legal-footer');
const publicLinks = (page: Page) => page.locator('nav.home-public-links');

test('home carries the public links, not the legal footer', async ({ page }) => {
	await gotoApp(page, '/');
	await expect(footer(page)).toHaveCount(0);

	await expect(publicLinks(page)).toBeVisible();
	await expect(
		publicLinks(page).getByRole('link', { name: 'Инструменты', exact: true })
	).toHaveAttribute('href', '/tools');
	await expect(
		publicLinks(page).getByRole('link', { name: 'Программы', exact: true })
	).toHaveAttribute('href', '/programs');
	await expect(
		publicLinks(page).getByRole('link', { name: 'Справочник', exact: true })
	).toHaveAttribute('href', '/articles');
});

test('public content keeps the footer, app screens drop it', async ({ page }) => {
	for (const path of ['/tools', '/exercise/0001', '/legal/requisites']) {
		await gotoApp(page, path);
		await expect(footer(page), path).toBeVisible();
	}

	for (const path of ['/auth', '/builder', '/workouts', '/cycle', '/exercises']) {
		await gotoApp(page, path);
		await expect(footer(page), path).toHaveCount(0);
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

test('profile keeps public content and legal documents reachable', async ({ page }) => {
	await gotoApp(page, '/auth');

	for (const [name, href] of [
		['Инструменты', '/tools'],
		['Программы', '/programs'],
		['Справочник', '/articles'],
		['Условия', '/terms'],
		['Конфиденциальность', '/privacy'],
		['Реквизиты', '/legal/requisites']
	] as const) {
		await expect(page.getByRole('link', { name, exact: true })).toHaveAttribute('href', href);
	}
});
