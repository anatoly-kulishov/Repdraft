import { test, expect } from '@playwright/test';
import { seedGuestStorage } from './helpers/app-ready';
import {
	clickUndoToast,
	confirmDeleteSession,
	HISTORY_E2E_SESSION_ID,
	openHistoryDetail,
	readStoredSessions,
	seedHistoryDetailSession
} from './helpers/history-detail';
import { isolateGuestCloud } from './helpers/skeleton-transition';

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
	await seedGuestStorage(page);
	await isolateGuestCloud(page);
	page.on('dialog', (d) => d.accept());
});

test('delete: confirm sheet removes session and navigates to history tab', async ({ page }) => {
	await seedHistoryDetailSession(page);
	await openHistoryDetail(page);

	await confirmDeleteSession(page);

	await page.waitForURL(/\/workouts\?tab=history/, { timeout: 10_000 });
	expect(await readStoredSessions(page)).toEqual([]);
	await expect(page.getByText('Skeleton E2E')).toHaveCount(0);
});

test('delete undo: restores session after snackbar undo', async ({ page }) => {
	await seedHistoryDetailSession(page);
	await openHistoryDetail(page);

	await confirmDeleteSession(page);
	await page.waitForURL(/\/workouts\?tab=history/, { timeout: 10_000 });

	await clickUndoToast(page);
	await page.waitForURL(new RegExp(`/workouts/history/${HISTORY_E2E_SESSION_ID}`), {
		timeout: 10_000
	});

	const stored = await readStoredSessions(page);
	expect(stored).toHaveLength(1);
	expect(stored[0]?.id).toBe(HISTORY_E2E_SESSION_ID);
	await expect(page.locator('.history-detail:not(.history-detail--skeleton)')).toBeVisible();
});

test('edit save: weight change persists after save', async ({ page }) => {
	await seedHistoryDetailSession(page);
	await openHistoryDetail(page);

	await page.getByRole('button', { name: /Редактировать|Edit/i }).click();
	const weightInput = page.locator('.history-set-weight').first();
	await weightInput.waitFor({ state: 'visible', timeout: 10_000 });
	await weightInput.fill('50');

	await page.getByRole('button', { name: /Сохранить|Save/i }).click();
	await expect(page.locator('.toast-item', { hasText: /История обновлена|History updated/i })).toBeVisible({
		timeout: 10_000
	});

	await expect(page.locator('.history-exercise__set-weight').first()).toContainText('50');

	const stored = await readStoredSessions(page);
	expect(stored[0]?.exercises[0]?.sets[0]?.weightKg).toBe(50);
});
