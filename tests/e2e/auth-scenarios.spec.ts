import { test, expect } from '@playwright/test';
import { seedGuestStorage, waitAppReady } from './helpers/app-ready';
import {
	E2E_AUTH_EMAIL,
	E2E_AUTH_PASSWORD,
	expectGuestSignInPanel,
	fillEmail,
	fillPassword,
	gotoAuth,
	hasAuthCredentials,
	isCloudAuthAvailable,
	minimalBackupJson,
	setAuthTab,
	signInWithCredentials,
	skipIfAuthFormError,
	submitPrimaryAuthForm,
	waitForCheckEmailOrSkip,
	waitForToastMatching
} from './helpers/auth';

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
	await seedGuestStorage(page);
	page.on('dialog', (d) => d.accept());
});

test('12.6.1 guest auth UI: tabs, magic link, prefs, backup, version', async ({ page }) => {
	await gotoAuth(page, 'next=%2F');
	await expectGuestSignInPanel(page);
	await expect(page.getByText(/^(Интерфейс|Interface)$/)).toBeVisible();
	await expect(page.getByRole('button', { name: /^(Скачать копию|Download backup)$/ })).toBeVisible();
	await expect(page.getByRole('button', { name: /^(Восстановить из файла|Restore from file)$/ })).toBeVisible();
	await expect(page.locator('.auth-account__version')).toBeVisible();
});

test('12.6 panels: signup tab, magic link, forgot, back navigation', async ({ page }) => {
	await gotoAuth(page);
	await setAuthTab(page, 'signup');
	await expect(page.getByText(/^(Ещё раз пароль|Confirm password|Repeat password)/i)).toBeVisible();

	await page.getByRole('button', { name: /ссылке на email|email link/i }).click();
	await expect(page.getByRole('button', { name: /^(Прислать ссылку|Send link)$/ })).toBeVisible();
	await page.getByRole('button', { name: /паролем|password/i }).click();
	await expectGuestSignInPanel(page);

	await page.getByRole('button', { name: /^(Забыли пароль|Forgot password)/ }).click();
	await expect(page.getByRole('button', { name: /^(Сбросить пароль|Reset password)$/ })).toBeVisible();
	await page.getByRole('button', { name: /^(К входу|Back to sign in)$/ }).click();
	await expectGuestSignInPanel(page);
});

test('12.6.7 password mismatch on signup (client validation)', async ({ page }) => {
	await gotoAuth(page);
	if (!(await isCloudAuthAvailable(page))) test.skip(true, 'Supabase not configured');
	await setAuthTab(page, 'signup');
	await fillEmail(page, 'mismatch@example.com');
	await fillPassword(page, 'secret123', 0);
	await fillPassword(page, 'different456', 1);
	await page.locator('.auth-signin form.auth-form').getByRole('button', { name: /^(Зарегистрироваться|Sign up)$/ }).click();
	await expect(page.locator('.auth-form__error')).toContainText(/не совпадают|do not match/i);
	await waitForToastMatching(page, /не совпадают|do not match/i);
});

test('12.6.3 sign in wrong password', async ({ page }) => {
	await gotoAuth(page);
	if (!(await isCloudAuthAvailable(page))) test.skip(true, 'Supabase not configured');
	await setAuthTab(page, 'signin');
	await fillEmail(page, E2E_AUTH_EMAIL || 'wrong@example.com');
	await fillPassword(page, 'definitely-wrong-password-xyz');
	await page.locator('.auth-signin form.auth-form').getByRole('button', { name: /^(Войти|Sign in)$/ }).click();
	await waitForToastMatching(page, /Неверный email|Invalid email|Invalid login|Ошибка входа|Sign-in error/i, 15_000);
	await expect(page.locator('.auth-form__error')).toContainText(
		/Неверный email|Invalid email|Invalid login|Ошибка входа|Sign-in error/i
	);
});

test('12.6.5 magic link sends check-email panel', async ({ page }) => {
	await gotoAuth(page);
	if (!(await isCloudAuthAvailable(page))) test.skip(true, 'Supabase not configured');
	const email = `e2e-magic-${Date.now()}@example.com`;
	await page.getByRole('button', { name: /ссылке на email|email link/i }).click();
	await fillEmail(page, email);
	await submitPrimaryAuthForm(page);
	await waitForCheckEmailOrSkip(page, 'Magic link');
	await expect(page.getByText(email)).toBeVisible();
});

test('12.6.6 forgot password sends check-email panel', async ({ page }) => {
	await gotoAuth(page);
	if (!(await isCloudAuthAvailable(page))) test.skip(true, 'Supabase not configured');
	const email = E2E_AUTH_EMAIL || `e2e-reset-${Date.now()}@example.com`;
	await page.getByRole('button', { name: /^(Забыли пароль|Forgot password)/ }).click();
	await fillEmail(page, email);
	await submitPrimaryAuthForm(page);
	await waitForCheckEmailOrSkip(page, 'Forgot password');
});

test('backup: empty export toast', async ({ page }) => {
	await gotoAuth(page);
	await page.getByRole('button', { name: /^(Скачать копию|Download backup)$/ }).click();
	await waitForToastMatching(page, /нечего сохранять|Nothing to save/i);
});

test('backup: invalid JSON file toast', async ({ page }) => {
	await gotoAuth(page);
	const input = page.locator('input[type="file"][accept*="json"]');
	await input.setInputFiles({
		name: 'bad.json',
		mimeType: 'application/json',
		buffer: Buffer.from('not-json')
	});
	await waitForToastMatching(page, /прочитать|read|invalid/i);
});

test('backup: valid file opens confirm sheet, cancel keeps data', async ({ page }) => {
	await gotoAuth(page);
	const input = page.locator('input[type="file"][accept*="json"]');
	await input.setInputFiles({
		name: 'empty-backup.json',
		mimeType: 'application/json',
		buffer: Buffer.from(minimalBackupJson())
	});
	await expect(page.locator('.bottom-sheet')).toBeVisible();
	await expect(page.getByText(/^(Восстановить из копии|Restore from backup)/)).toBeVisible();
	await page.getByRole('button', { name: /^(Отмена|Cancel)$/ }).click();
	await expect(page.locator('.bottom-sheet')).toHaveCount(0);
});

test('12.6.17 language toggle updates auth copy', async ({ page }) => {
	await gotoAuth(page);
	await page.getByRole('button', { name: /Язык.*Русский|Language.*Russian/i }).click();
	await expect(page.getByRole('tab', { name: /^Sign in$/ })).toBeVisible();
	await page.getByRole('button', { name: /Язык.*English|Language.*English/i }).click();
	await expect(page.getByRole('tab', { name: /^Вход$/ })).toBeVisible();
});

test('12.6.16 light theme auth renders sign-in panel', async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('repdraft.theme', 'light');
	});
	await gotoAuth(page);
	await expectGuestSignInPanel(page);
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('skeleton query guest vs account', async ({ page }) => {
	await gotoAuth(page, 'skeleton=guest');
	await expect(page.locator('.page-skeleton')).toBeVisible();
	await gotoAuth(page, 'skeleton=account');
	await expect(page.locator('.page-skeleton')).toBeVisible();
});

test('password visibility toggle', async ({ page }) => {
	await gotoAuth(page);
	const field = page.locator('input[autocomplete="current-password"]').first();
	await field.fill('secret123');
	await expect(field).toHaveAttribute('type', 'password');
	await page.getByRole('button', { name: /^(Показать пароль|Show password)$/ }).click();
	await expect(field).toHaveAttribute('type', 'text');
});

test('12.6.13 next param preserved in URL before login', async ({ page }) => {
	await gotoAuth(page, 'next=%2Frecords');
	await expect(page).toHaveURL(/next=%2Frecords|next=%252Frecords/);
});

test('12.6 signed-in flows', async ({ page }, testInfo) => {
	test.skip(!hasAuthCredentials, 'Set E2E_AUTH_EMAIL and E2E_AUTH_PASSWORD for signed-in auth scenarios');

	const stamp = `E2E Auth ${testInfo.project.name} ${Date.now().toString(36).slice(-4)}`;

	// Guest plan for migrate check
	await page.goto('/builder?new');
	await waitAppReady(page);
	const isMobile = testInfo.project.name.startsWith('mobile');
	const nameInput = isMobile
		? page.locator('.builder-chrome__name')
		: page.locator('.builder-name-desktop input[type="text"]');
	await nameInput.waitFor({ state: 'visible', timeout: 10_000 });
	await nameInput.fill(stamp);
	const saveBtn = isMobile
		? page.locator('.sticky-actions button.btn-primary').filter({ hasText: /Сохранить|Save/ })
		: page.locator('.builder-toolbar-save');
	await expect(saveBtn.first()).toBeEnabled({ timeout: 10_000 });
	await saveBtn.first().click();
	await page.waitForURL(/\/workouts\/?$/, { timeout: 25_000 });

	// Login with next=/records
	await signInWithCredentials(page, E2E_AUTH_EMAIL, E2E_AUTH_PASSWORD, 'next=%2Frecords');
	await expect(page).toHaveURL(/\/records/, { timeout: 15_000 });

	// Migrate toast (guest had a plan)
	await waitForToastMatching(page, /загружены|uploaded/i).catch(() => {
		/* toast may have expired */
	});

	await gotoAuth(page);
	await expect(page.locator('.profile-hero')).toBeVisible();
	await expect(page.getByText(E2E_AUTH_EMAIL)).toBeVisible();

	// Greeting name save
	const greetingInput = page.locator('#auth-greeting-name');
	await greetingInput.fill('E2E Tester');
	await page.locator('#auth-greeting-panel').getByRole('button', { name: /^(Сохранить имя|Save name)$/ }).click();
	await waitForToastMatching(page, /сохранено|saved/i);

	// Logout
	await page.getByRole('button', { name: /^(Выйти|Log out)$/ }).click();
	await waitForToastMatching(page, /вышли|signed out/i);
	await expectGuestSignInPanel(page);

	const plansAfterLogout = await page.evaluate(() => localStorage.getItem('repdraft:plans'));
	expect(plansAfterLogout).toBeNull();
});

test('12.6.14 open redirect blocked after login', async ({ page }) => {
	test.skip(!hasAuthCredentials, 'Set E2E_AUTH_EMAIL and E2E_AUTH_PASSWORD');
	await signInWithCredentials(page, E2E_AUTH_EMAIL, E2E_AUTH_PASSWORD, 'next=https%3A%2F%2Fevil.com');
	await expect(page).toHaveURL(/\/workouts/, { timeout: 15_000 });
	await expect(page.url()).not.toContain('evil.com');
});
