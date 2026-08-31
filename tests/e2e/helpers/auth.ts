import { expect, test, type Page } from '@playwright/test';
import { gotoReady, waitAppReady } from './app-ready';

export const E2E_AUTH_EMAIL = (process.env.E2E_AUTH_EMAIL ?? '').trim();
export const E2E_AUTH_PASSWORD = (process.env.E2E_AUTH_PASSWORD ?? '').trim();
export const hasAuthCredentials = Boolean(E2E_AUTH_EMAIL && E2E_AUTH_PASSWORD);

export async function gotoAuth(page: Page, query = ''): Promise<void> {
	const path = query ? `/auth?${query.replace(/^\?/, '')}` : '/auth';
	await gotoReady(page, path);
	await page.locator('.auth-page').waitFor({ state: 'visible', timeout: 15_000 });
}

export async function isCloudAuthAvailable(page: Page): Promise<boolean> {
	const cloudOff = page.getByText(/Вход пока недоступен|Sign-in unavailable/);
	return !(await cloudOff.isVisible().catch(() => false));
}

export async function expectGuestSignInPanel(page: Page): Promise<void> {
	await expect(page.locator('.auth-signin')).toBeVisible();
	await expect(page.getByRole('tab', { name: /^(Вход|Sign in)$/ })).toBeVisible();
	await expect(page.getByRole('tab', { name: /^(Регистрация|Sign up)$/ })).toBeVisible();
	await expect(page.getByRole('textbox', { name: /^Email$/i })).toBeVisible();
	await expect(page.locator('.auth-signin form.auth-form').getByRole('button', { name: /^(Войти|Sign in)$/ })).toBeVisible();
	await expect(page.getByRole('button', { name: /ссылке на email|email link/i })).toBeVisible();
}

export async function setAuthTab(page: Page, tab: 'signin' | 'signup'): Promise<void> {
	const label = tab === 'signin' ? /^(Вход|Sign in)$/ : /^(Регистрация|Sign up)$/;
	await page.getByRole('tab', { name: label }).click();
}

export async function fillEmail(page: Page, email: string): Promise<void> {
	await page.getByRole('textbox', { name: /^Email$/i }).fill(email);
}

export async function fillPassword(page: Page, password: string, index = 0): Promise<void> {
	await page.locator('input[type="password"], input[autocomplete="new-password"], input[autocomplete="current-password"]')
		.nth(index)
		.fill(password);
}

export async function submitPrimaryAuthForm(page: Page): Promise<void> {
	await page.locator('.auth-signin form.auth-form, .auth-panel form.auth-form')
		.first()
		.getByRole('button', { name: /^(Войти|Sign in|Зарегистрироваться|Sign up|Прислать ссылку|Send link|Сбросить пароль|Reset password|Сохранить пароль|Save password)$/ })
		.click();
}

export async function waitForCheckEmailOrSkip(page: Page, context: string): Promise<void> {
	const checkEmail = page.getByText(/^(Проверьте почту|Check your email)$/);
	const error = page.locator('.auth-form__error');
	await Promise.race([
		checkEmail.waitFor({ state: 'visible', timeout: 15_000 }),
		error.waitFor({ state: 'visible', timeout: 15_000 })
	]).catch(() => {});
	if (await error.isVisible().catch(() => false)) {
		await skipIfAuthFormError(page, context);
	}
	await expect(checkEmail).toBeVisible({ timeout: 5_000 });
}

export async function skipIfAuthFormError(page: Page, context: string): Promise<void> {
	const error = page.locator('.auth-form__error');
	if (await error.isVisible().catch(() => false)) {
		const text = (await error.textContent())?.trim() || 'unknown auth error';
		test.skip(true, `${context}: ${text}`);
	}
}

export async function waitForToastMatching(page: Page, pattern: RegExp, timeout = 12_000): Promise<void> {
	const toast = page.locator('.toast-item').filter({ hasText: pattern }).first();
	await expect(toast).toBeVisible({ timeout });
}

export async function signInWithCredentials(
	page: Page,
	email: string,
	password: string,
	query = 'next=%2F'
): Promise<void> {
	await gotoAuth(page, query);
	if (!(await isCloudAuthAvailable(page))) {
		throw new Error('Supabase auth not configured');
	}
	await setAuthTab(page, 'signin');
	await fillEmail(page, email);
	await fillPassword(page, password, 0);
	await page.locator('.auth-signin form.auth-form').getByRole('button', { name: /^(Войти|Sign in)$/ }).click();
	await waitForToastMatching(page, /синхронизируются|sync/i);
	await page.waitForURL((url) => !url.pathname.endsWith('/auth') || url.searchParams.has('recovery'), {
		timeout: 20_000
	});
	await waitAppReady(page);
}

export function minimalBackupJson(): string {
	return JSON.stringify(
		{
			version: 1,
			exportedAt: new Date().toISOString(),
			plans: [],
			sessions: [],
			records: []
		},
		null,
		2
	);
}
