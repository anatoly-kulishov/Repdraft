/**
 * Adversarial probes against the sacred loop (phone athlete).
 * Only empirically failing attacks belong here.
 */
import { test, expect, type Page } from '@playwright/test';
import { gotoReady, seedGuestStorage, waitAppReady } from './helpers/app-ready';
import { workoutPreviewStartButton } from './helpers/flow-locators';
import { isolateGuestCloud } from './helpers/skeleton-transition';

const PLAN_ID = 'e2e-adv-plan';

async function seedPlan(
	page: Page,
	opts?: { exercises?: number; sets?: number; name?: string }
): Promise<void> {
	const indexRes = await page.request.get('/data/exercises.index.json');
	const index = (await indexRes.json()) as { id: string }[];
	const exerciseId = index[0]?.id ?? '0025';
	const now = new Date().toISOString();
	const exCount = opts?.exercises ?? 1;
	const sets = opts?.sets ?? 1;
	const name = opts?.name ?? 'Adv E2E';
	const origin = (process.env.BASE_URL ?? 'http://127.0.0.1:5173').replace(/\/$/, '');
	await page.context().addCookies([
		{ name: 'repdraft_workouts_plan_rows', value: '1', url: origin },
		{ name: 'repdraft_home_has_plans', value: '1', url: origin }
	]);
	await page.addInitScript(
		({ planId, exerciseId: exId, now: ts, exCount: n, sets: setN, name: planName }) => {
			const exercises = Array.from({ length: n }, () => ({
				exerciseId: exId,
				sets: setN,
				reps: 8,
				restSec: 60
			}));
			localStorage.setItem(
				'repdraft:plans',
				JSON.stringify([
					{
						id: planId,
						name: planName,
						createdAt: ts,
						updatedAt: ts,
						exercises
					}
				])
			);
			document.cookie = 'repdraft_home_has_plans=1; path=/; Max-Age=31536000; SameSite=Lax';
			document.cookie =
				'repdraft_workouts_plan_rows=1; path=/; Max-Age=31536000; SameSite=Lax';
		},
		{ planId: PLAN_ID, exerciseId, now, exCount, sets, name }
	);
}

async function openLive(page: Page): Promise<void> {
	await gotoReady(page, `/workouts/${PLAN_ID}`);
	const startBtn = workoutPreviewStartButton(page, true);
	await startBtn.waitFor({ state: 'visible', timeout: 15_000 });
	await startBtn.click();
	await page.waitForURL(/\/live\//, { timeout: 20_000 });
	await waitAppReady(page);
	await page.locator('.live-panel').waitFor({ state: 'visible', timeout: 15_000 });
}

async function logOneSet(page: Page, weight = '40', reps = '8'): Promise<void> {
	const w = page.locator('input.live-set-weight:not([readonly])').first();
	const r = page.locator('input.live-set-reps:not([readonly])').first();
	await w.waitFor({ state: 'visible', timeout: 10_000 });
	await w.fill(weight);
	await r.fill(reps);
	await page.locator('.live-set-done-btn:not(.live-set-done-btn--done)').first().click();
}

async function confirmFinishSheet(page: Page): Promise<void> {
	const sheet = page.locator('[aria-labelledby="live-finish-offer-title"]');
	await sheet.waitFor({ state: 'visible', timeout: 10_000 });
	await sheet.getByRole('button', { name: /Завершить|Finish/i }).click();
}

test.describe('Sacred-loop adversarial regression', () => {
	test.beforeEach(async ({ page }) => {
		await seedGuestStorage(page);
		await isolateGuestCloud(page);
		page.on('dialog', (d) => d.accept());
	});

	test('A1 storage full on Start: lies with «plan not found» (sacred Start dead)', async ({
		page
	}, info) => {
		test.skip(!info.project.name.startsWith('mobile'), 'phone athlete');
		test.setTimeout(60_000);
		await seedPlan(page, { sets: 1 });
		await page.addInitScript(() => {
			const orig = Storage.prototype.setItem;
			Storage.prototype.setItem = function (key: string, value: string) {
				if (String(key).includes('active-session')) {
					throw new DOMException('QuotaExceededError', 'QuotaExceededError');
				}
				return orig.call(this, key, value);
			};
		});
		await gotoReady(page, `/workouts/${PLAN_ID}`);
		const startBtn = workoutPreviewStartButton(page, true);
		await startBtn.waitFor({ state: 'visible', timeout: 15_000 });
		await startBtn.click();
		await page.waitForURL(/\/live\//, { timeout: 20_000 });
		await waitAppReady(page);
		await page.waitForTimeout(800);

		const state = await page.evaluate(() => {
			const emptyTitle =
				document.querySelector('.empty-state h2, .empty-state [class*="title"]')?.textContent ??
				'';
			const emptyDesc = document.querySelector('.empty-state p')?.textContent ?? '';
			const live = Boolean(document.querySelector('.live-panel'));
			const body = (document.body.innerText || '').slice(0, 500);
			return { emptyTitle, emptyDesc, live, body };
		});

		// Plan exists; Start must open live OR show an honest storage/error signal.
		const lie =
			!state.live &&
			(/не найдена|not found/i.test(state.emptyTitle + state.body) ||
				/нет упражнений|no exercises/i.test(state.emptyDesc + state.body));
		const honestQuota = /quota|мест|хранен|storage|localStorage|заполн/i.test(state.body);
		expect(lie && !honestQuota, JSON.stringify(state)).toBe(false);
	});

	test('A2 keyboard-open: Finish sticky is inert after last set (cannot tap primary)', async ({
		page
	}, info) => {
		test.skip(!info.project.name.startsWith('mobile'), 'vv keyboard');
		test.setTimeout(90_000);
		await seedPlan(page, { sets: 1 });
		await openLive(page);
		await logOneSet(page);
		await expect(page.locator('.live-sticky-actions, .sticky-actions').first()).toBeVisible({
			timeout: 10_000
		});
		await page.evaluate(() => {
			document.documentElement.setAttribute('data-keyboard-open', '');
			document.body.style.setProperty('--sticky-actions-h', '0px');
			document.documentElement.style.setProperty('--vv-fixed-bottom', '280px');
			document.documentElement.style.setProperty('--vv-keyboard-inset', '280px');
		});
		await page.waitForTimeout(150);
		const finish = page
			.locator('.live-sticky-actions button, .sticky-actions button')
			.filter({ hasText: /Завершить|Finish/i })
			.first();
		const blocked = await finish.evaluate((el) => {
			const style = getComputedStyle(el.closest('.sticky-actions') ?? el);
			const r = el.getBoundingClientRect();
			return {
				visibility: style.visibility,
				pointerEvents: style.pointerEvents,
				inView: r.bottom > 0 && r.top < window.innerHeight,
				height: r.height
			};
		});
		const tappable =
			blocked.visibility !== 'hidden' &&
			blocked.pointerEvents !== 'none' &&
			blocked.inView &&
			blocked.height >= 48;
		expect(tappable, JSON.stringify(blocked)).toBe(true);
	});

	test('A3 mid-live quota: Done silently fails (no toast, set not logged)', async ({
		page
	}, info) => {
		test.skip(!info.project.name.startsWith('mobile'), 'phone athlete');
		test.setTimeout(90_000);
		await seedPlan(page, { sets: 2 });
		await openLive(page);
		await page.evaluate(() => {
			const orig = Storage.prototype.setItem;
			Storage.prototype.setItem = function (key: string, value: string) {
				if (String(key).includes('active-session')) {
					throw new DOMException('QuotaExceededError', 'QuotaExceededError');
				}
				return orig.call(this, key, value);
			};
		});
		await page.locator('input.live-set-weight:not([readonly])').first().fill('40');
		await page.locator('input.live-set-reps:not([readonly])').first().fill('8');
		await page.locator('.live-set-done-btn:not(.live-set-done-btn--done)').first().click();
		await page.waitForTimeout(500);
		const uiDone = await page.locator('.live-set-done-btn--done').count();
		const errorToast = await page
			.locator('.toast-item')
			.filter({ hasText: /ошиб|error|хран|quota|мест/i })
			.count();
		const active = await page.evaluate(() => {
			try {
				return JSON.parse(localStorage.getItem('repdraft:active-session') ?? 'null');
			} catch {
				return null;
			}
		});
		const completed =
			active?.exercises?.[0]?.sets?.filter((s: { completed?: boolean }) => s.completed).length ??
			0;
		// Contract: Done either persists the set, or surfaces a clear error.
		expect(
			completed >= 1 || errorToast > 0,
			JSON.stringify({ uiDone, completed, errorToast })
		).toBe(true);
	});

	test('A4 finish with 0 completed sets still claims «Тренировка сохранена»', async ({
		page
	}, info) => {
		test.skip(!info.project.name.startsWith('mobile'), 'phone athlete');
		test.setTimeout(90_000);
		await seedPlan(page, { sets: 2 });
		await openLive(page);
		const finish = page
			.locator('.live-sticky-actions button, .sticky-actions button')
			.filter({ hasText: /Завершить|Finish/i })
			.first();
		await finish.waitFor({ state: 'visible', timeout: 10_000 });
		await finish.click();
		await confirmFinishSheet(page);
		await page.waitForURL(/\/workouts/, { timeout: 20_000 });
		await waitAppReady(page);
		const outcome = await page.evaluate(() => {
			const sessions = JSON.parse(localStorage.getItem('repdraft:sessions') ?? '[]') as {
				finishedAt?: string;
				exercises?: { sets?: { completed?: boolean }[] }[];
			}[];
			const last = sessions[0];
			const completedSets =
				last?.exercises?.reduce(
					(n, ex) => n + (ex.sets?.filter((s) => s.completed).length ?? 0),
					0
				) ?? 0;
			return {
				url: location.pathname + location.search,
				finished: Boolean(last?.finishedAt),
				completedSets,
				toast: Array.from(document.querySelectorAll('.toast-item'))
					.map((n) => n.textContent ?? '')
					.join(' '),
				heading: document.querySelector('h1')?.textContent ?? ''
			};
		});
		if (
			outcome.url.includes('/summary') ||
			/сохран|saved/i.test(outcome.toast) ||
			/завершен|completed|finished/i.test(outcome.heading)
		) {
			expect(
				outcome.completedSets,
				`claimed save with ${outcome.completedSets} sets: ${JSON.stringify(outcome)}`
			).toBeGreaterThan(0);
		}
	});

	test('A5 empty finish pollutes history: «0 подходов» row listed as workout', async ({
		page
	}, info) => {
		test.skip(!info.project.name.startsWith('mobile'), 'phone athlete');
		test.setTimeout(90_000);
		await seedPlan(page, { sets: 3 });
		await openLive(page);
		const finish = page
			.locator('.live-sticky-actions button, .sticky-actions button')
			.filter({ hasText: /Завершить|Finish/i })
			.first();
		await finish.click();
		await confirmFinishSheet(page);
		await page.waitForURL(/\/workouts/, { timeout: 20_000 });
		await gotoReady(page, '/workouts?tab=history');
		await page.waitForTimeout(800);
		const hist = await page.evaluate(() => {
			const sessions = JSON.parse(localStorage.getItem('repdraft:sessions') ?? '[]') as {
				id: string;
				exercises?: { sets?: { completed?: boolean }[] }[];
			}[];
			const emptyIds = sessions
				.filter(
					(s) =>
						(s.exercises?.reduce(
							(n, ex) => n + (ex.sets?.filter((x) => x.completed).length ?? 0),
							0
						) ?? 0) === 0
				)
				.map((s) => s.id);
			const body = (document.body.innerText || '').slice(0, 600);
			return { emptyIds, body, hasZeroSetsLabel: /0\s*подход/i.test(body) };
		});
		expect(hist.emptyIds.length === 0 && !hist.hasZeroSetsLabel, JSON.stringify(hist)).toBe(
			true
		);
	});

	test('A6 finish-offer primary in sheet hit height <48px', async ({ page }, info) => {
		test.skip(!info.project.name.startsWith('mobile'), 'touch');
		test.setTimeout(90_000);
		await seedPlan(page, { sets: 2 });
		await openLive(page);
		const finish = page
			.locator('.live-sticky-actions button, .sticky-actions button')
			.filter({ hasText: /Завершить|Finish/i })
			.first();
		await finish.click();
		const sheetBtn = page
			.locator('[aria-labelledby="live-finish-offer-title"]')
			.getByRole('button', { name: /Завершить|Finish/i });
		await sheetBtn.waitFor({ state: 'visible', timeout: 10_000 });
		await page.waitForTimeout(400);
		const size = await sheetBtn.evaluate((el) => {
			const r = el.getBoundingClientRect();
			return { w: Math.round(r.width), h: Math.round(r.height) };
		});
		expect(size.w, JSON.stringify(size)).toBeGreaterThanOrEqual(48);
		expect(size.h, JSON.stringify(size)).toBeGreaterThanOrEqual(48);
	});
});
