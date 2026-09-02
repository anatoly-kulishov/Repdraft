import type { Page } from '@playwright/test';
import { gotoReady, waitAppReady } from './app-ready';
import { ensureWorkoutSeed, seedMinimalPlan } from './skeleton-transition';

export const HISTORY_E2E_SESSION_ID = 'e2e-skeleton-session';

export async function seedHistoryDetailSession(page: Page): Promise<{
	planId: string;
	exerciseId: string;
	sessionId: string;
}> {
	const { planId, exerciseId } = await seedMinimalPlan(page);
	await gotoReady(page, '/workouts?tab=history');
	await ensureWorkoutSeed(page, { planId, exerciseId, finishedSessionId: HISTORY_E2E_SESSION_ID });
	await page.reload({ waitUntil: 'domcontentloaded' });
	await waitAppReady(page);
	return { planId, exerciseId, sessionId: HISTORY_E2E_SESSION_ID };
}

export async function openHistoryDetail(
	page: Page,
	sessionId = HISTORY_E2E_SESSION_ID
): Promise<void> {
	await gotoReady(page, `/workouts/history/${sessionId}`);
	await page.locator('.history-detail:not(.history-detail--skeleton)').waitFor({ timeout: 15_000 });
}

export async function confirmDeleteSession(page: Page): Promise<void> {
	await page.getByRole('button', { name: /Удалить запись|Delete entry/i }).click();
	await page
		.locator('.bottom-sheet')
		.getByRole('button', { name: /^Удалить$|^Delete$/ })
		.click();
}

export async function clickUndoToast(page: Page): Promise<void> {
	await page.locator('.toast-undo-snackbar__action').click();
}

export function readStoredSessions(page: Page) {
	return page.evaluate(() => JSON.parse(localStorage.getItem('repdraft:sessions') ?? '[]'));
}
