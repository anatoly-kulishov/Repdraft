import { expect, type Page } from '@playwright/test';

/** Production origin baked into canonical / hreflang / sitemap. */
export const SITE = 'https://www.repdraft.ru';

/**
 * Seed localStorage before the app boots. Playwright gives every test a fresh
 * browser context, so this is the only state a test starts with.
 */
export async function seedLocalStorage(page: Page, entries: Record<string, unknown>) {
	await page.addInitScript((data) => {
		try {
			for (const [key, value] of Object.entries(data)) {
				localStorage.setItem(key, JSON.stringify(value));
			}
		} catch {
			/* localStorage may be unavailable in about:blank */
		}
	}, entries);
}

/** Navigate and wait for the PWA boot splash to be removed. */
export async function gotoApp(page: Page, path: string) {
	await page.goto(path, { waitUntil: 'load' });
	await page
		.locator('#pwa-boot')
		.waitFor({ state: 'detached', timeout: 15_000 })
		.catch(() => {});

	// Intro coachmarks, offers and the cookie notice can mount a tick after
	// hydration and then block clicks (bottom-sheet backdrop / modal). Poll and clear.
	for (let attempt = 0; attempt < 10; attempt++) {
		// Nearest overlay first: bottom sheets (builder intro, one-time offers).
		const sheetAck = page
			.locator('.bottom-sheet button', { hasText: /^(Понятно|Got it|OK)$/ })
			.first();
		if (await sheetAck.isVisible().catch(() => false)) {
			await sheetAck.click({ timeout: 1_500 }).catch(() => {});
		} else {
			const backdrop = page.locator('.bottom-sheet__backdrop');
			if (await backdrop.isVisible().catch(() => false)) {
				await backdrop.click({ timeout: 1_500, force: true }).catch(() => {});
			}
		}

		const dialogAck = page
			.locator('dialog[open] button', { hasText: /^(Понятно|Got it|OK)$/ })
			.first();
		if (await dialogAck.isVisible().catch(() => false)) {
			await dialogAck.click({ timeout: 1_500 }).catch(() => {});
		}

		const acceptCookies = page.locator('.cookie-notice__button');
		if (await acceptCookies.isVisible().catch(() => false)) {
			await acceptCookies.click({ timeout: 1_500 }).catch(() => {});
		}

		const blocking =
			(await page.locator('.bottom-sheet__backdrop').count()) > 0 ||
			(await page.locator('dialog[open]').count()) > 0 ||
			(await page.locator('.cookie-notice__button').count()) > 0;
		if (!blocking) break;
		await page.waitForTimeout(200);
	}
}

/** i18n keys leaked into the DOM (e.g. `programs.progress`). */
export function i18nLeaks(text: string): string[] {
	const matches =
		text.match(
			/\b(?:tools|programs|rating|seo|builder|workouts|summary|program|session|cycle|preview|live|nav|settings|lang)\.[a-zA-Z]{2,}\b/g
		) ?? [];
	return [...new Set(matches)];
}

/** Unresolved `{name}` placeholders that should have been interpolated. */
export function placeholderLeaks(text: string): string[] {
	return [
		...(text.match(/\{(?:n|done|total|sets|reps|rest|program|session|percent|count|name)\}/g) ?? [])
	];
}

/**
 * Walk the live session to the last exercise, mark every set, then confirm finish.
 * The finish button only exists on the last exercise, so the loop keeps pressing
 * "next" until it is gone. Marking the last set auto-opens the "all sets ready"
 * sheet, so every click uses a short timeout and the sheet is detected first.
 */
export async function finishLiveSession(page: Page) {
	// Inline coachmark (role=note) can sit over the first controls.
	const dismissNote = page.locator('.onboarding-coachmark__dismiss');
	if (await dismissNote.isVisible().catch(() => false)) {
		await dismissNote.click({ timeout: 1_500 }).catch(() => {});
	}

	const markAll = page.locator('button[aria-label="Отметить все подходы"]:visible').first();
	const next = page.locator('button[aria-label="Следующее упражнение"]:visible').first();
	const finished = page.getByRole('button', { name: 'Завершить', exact: true });
	// Only open sheets expose a dialog role.
	const sheet = page.getByRole('dialog');
	const sheetFinish = sheet.getByRole('button', { name: 'Завершить', exact: true }).first();

	for (let i = 0; i < 16; i++) {
		if ((await sheet.count()) > 0) break;
		if (await markAll.isVisible().catch(() => false)) {
			await markAll.click({ timeout: 2_000 }).catch(() => {});
			await page.waitForTimeout(200);
			if ((await sheet.count()) > 0) break;
		}
		if (!(await next.isVisible().catch(() => false))) break;
		await next.click({ timeout: 2_000 }).catch(() => {});
		await page.waitForTimeout(300);
	}

	if ((await sheetFinish.count()) === 0) {
		if (await markAll.isVisible().catch(() => false)) {
			await markAll.click({ timeout: 2_000 }).catch(() => {});
		}
		if ((await sheetFinish.count()) === 0) {
			await finished.first().click({ timeout: 5_000 });
		}
	}

	await expect(sheetFinish).toBeVisible();
	await sheetFinish.click();
	await expect(page).toHaveURL(/\/workouts\/summary\?id=/, { timeout: 20_000 });
}

/** Rate a finished session and assert the panel records it. */
export async function rateFinishedSession(page: Page, stars = 4) {
	const panel = page.locator('.session-rating');
	await expect(panel).toBeVisible();
	const starButtons = panel.locator('.session-rating__star');
	await expect(starButtons).toHaveCount(5);
	await starButtons.nth(stars - 1).click();
	await expect(panel.locator('[aria-pressed="true"]')).toHaveCount(1);
}

/** A deterministic draft so the builder can be covered without catalog clicks. */
export function draftPlan() {
	const now = '2026-11-21T10:00:00.000Z';
	return {
		id: 'e2e-draft',
		name: '',
		createdAt: now,
		updatedAt: now,
		exercises: [
			{ exerciseId: '0001', sets: 3, reps: 10, restSec: 90 },
			{ exerciseId: '0002', sets: 3, reps: 12, restSec: 60 }
		]
	};
}
