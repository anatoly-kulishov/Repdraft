import { expect, type Page } from '@playwright/test';
import { seedGuestStorage, waitAppReady } from './app-ready';

export type SkeletonTransitionSpec = {
	id: string;
	path: string;
	/** Visible while booting / loading. */
	skeleton: string;
	/** Stable content after load. */
	ready: string;
	/** Optional: sum heights of these nodes for ready-state comparison. */
	readyHeightSelectors?: string[];
	/** Optional: sum heights when skeleton is split across nodes. */
	skeletonHeightSelectors?: string[];
	/** Max cumulative layout shift during navigation (unitless). */
	maxCls?: number;
	/** Max |Δheight| between skeleton root and ready root (px). Skip when null. */
	maxHeightDeltaPx?: number | null;
	/** Delay exercises.index.json to keep skeleton on screen. */
	indexDelayMs?: number;
	/** Post-ready settle before height compare (infinite scroll can inflate ready height). */
	settleMs?: number;
	setup?: (page: Page) => Promise<void>;
};

const DEFAULT_MAX_CLS = 0.12;
const DEFAULT_MAX_HEIGHT_DELTA = 96;

export async function installLayoutShiftObserver(page: Page): Promise<void> {
	await page.addInitScript(() => {
		(window as unknown as { __repdraftCls?: number }).__repdraftCls = 0;
		try {
			new PerformanceObserver((list) => {
				for (const entry of list.getEntries()) {
					const shift = entry as PerformanceEntry & {
						value?: number;
						hadRecentInput?: boolean;
					};
					if (shift.hadRecentInput) continue;
					(window as unknown as { __repdraftCls?: number }).__repdraftCls =
						((window as unknown as { __repdraftCls?: number }).__repdraftCls ?? 0) +
						(shift.value ?? 0);
				}
			}).observe({ type: 'layout-shift', buffered: true });
		} catch {
			/* unsupported */
		}
	});
}

export async function delayExerciseIndex(page: Page, ms: number): Promise<void> {
	await page.route('**/data/exercises.index.json', async (route) => {
		await new Promise((r) => setTimeout(r, ms));
		await route.continue();
	});
}

export async function seedMinimalPlan(page: Page): Promise<{ planId: string; exerciseId: string }> {
	const indexRes = await page.request.get('/data/exercises.index.json');
	const index = (await indexRes.json()) as { id: string }[];
	const exerciseId = index[0]?.id ?? '0025';
	const planId = 'e2e-skeleton-plan';
	const now = new Date().toISOString();

	const origin = (process.env.BASE_URL ?? 'http://127.0.0.1:5173').replace(/\/$/, '');
	await page.context().addCookies([
		{ name: 'repdraft_workouts_plan_rows', value: '1', url: origin },
		{ name: 'repdraft_home_has_plans', value: '1', url: origin }
	]);

	await page.addInitScript(
		({ planId: id, exerciseId: exId, now: ts }) => {
			const plan = {
				id,
				name: 'Skeleton E2E',
				createdAt: ts,
				updatedAt: ts,
				exercises: [{ exerciseId: exId, targetSets: 3, targetReps: 8, restSec: 90 }]
			};
			localStorage.setItem('repdraft:plans', JSON.stringify([plan]));
			document.documentElement.dataset.workoutsPlanRows = '1';
			document.cookie =
				'repdraft_workouts_plan_rows=1; path=/; Max-Age=31536000; SameSite=Lax';
			document.cookie = 'repdraft_home_has_plans=1; path=/; Max-Age=31536000; SameSite=Lax';
		},
		{ planId, exerciseId, now }
	);

	return { planId, exerciseId };
}

export async function seedFinishedSession(
	page: Page,
	planId: string,
	exerciseId: string
): Promise<string> {
	const sessionId = 'e2e-skeleton-session';
	const now = new Date().toISOString();

	await page.addInitScript(
		({ sessionId: id, planId: pId, exerciseId: exId, now: ts }) => {
			const session = {
				id,
				planId: pId,
				planName: 'Skeleton E2E',
				startedAt: ts,
				finishedAt: ts,
				exercises: [
					{
						exerciseId: exId,
						targetSets: 3,
						targetReps: 8,
						restSec: 90,
						sets: [{ weightKg: 40, reps: 8, completed: true, kind: 'work' as const }]
					}
				]
			};
			localStorage.setItem('repdraft:sessions', JSON.stringify([session]));
		},
		{ sessionId, planId, exerciseId, now }
	);

	return sessionId;
}

/** Seed an in-progress session for home continue-card skeleton parity. */
export async function seedActiveSession(
	page: Page,
	planId: string,
	exerciseId: string
): Promise<void> {
	await page.addInitScript(
		({ planId: pId, exerciseId: exId }) => {
			const session = {
				id: 'e2e-active-session',
				planId: pId,
				planName: 'Skeleton E2E',
				startedAt: new Date().toISOString(),
				finishedAt: null,
				exercises: [{ exerciseId: exId, targetSets: 3, targetReps: 8, restSec: 90, sets: [] }]
			};
			localStorage.setItem('repdraft:active-session', JSON.stringify(session));
			document.documentElement.dataset.homeActiveSession = '1';
			document.cookie = 'repdraft_home_active=1; path=/; Max-Age=31536000; SameSite=Lax';
		},
		{ planId, exerciseId }
	);
}

/** Seed up to 3 finished sessions for home recent-list skeleton parity. */
export async function seedHomeRecentSessions(
	page: Page,
	planId: string,
	exerciseId: string,
	count = 3
): Promise<void> {
	await page.addInitScript(
		({ planId: pId, exerciseId: exId, count: n }) => {
			const sessions = Array.from({ length: n }, (_, index) => {
				const ts = new Date(Date.now() - index * 86_400_000).toISOString();
				return {
					id: `e2e-skeleton-session-${index}`,
					planId: pId,
					planName: 'Skeleton E2E',
					startedAt: ts,
					finishedAt: ts,
					exercises: [
						{
							exerciseId: exId,
							targetSets: 3,
							targetReps: 8,
							restSec: 90,
							sets: [{ weightKg: 40, reps: 8, completed: true, kind: 'work' as const }]
						}
					]
				};
			});
			localStorage.setItem('repdraft:sessions', JSON.stringify(sessions));
			document.documentElement.dataset.homeRecentRows = n > 0 ? '3' : '0';
			if (n > 0) {
				document.cookie =
					'repdraft_home_has_history=1; path=/; Max-Age=31536000; SameSite=Lax';
			}
		},
		{ planId, exerciseId, count }
	);
}

async function readCls(page: Page): Promise<number> {
	return page.evaluate(() => (window as unknown as { __repdraftCls?: number }).__repdraftCls ?? 0);
}

async function measureSelectorsHeight(page: Page, selectors: string[]): Promise<number> {
	return page.evaluate((sels) => {
		let total = 0;
		for (const sel of sels) {
			for (const el of document.querySelectorAll(sel)) {
				total += el.getBoundingClientRect().height;
			}
		}
		return total;
	}, selectors);
}

/** Navigate, observe skeleton → content, assert low CLS and stable layout. */
export async function assertSkeletonTransition(
	page: Page,
	spec: SkeletonTransitionSpec
): Promise<void> {
	await installLayoutShiftObserver(page);
	try {
		await page.unroute('**/data/exercises.index.json');
	} catch {
		/* no prior route */
	}
	if (spec.indexDelayMs) await delayExerciseIndex(page, spec.indexDelayMs);
	if (spec.setup) await spec.setup(page);

	await page.goto(spec.path, { waitUntil: 'domcontentloaded', timeout: 30_000 });
	await waitAppReady(page);

	const skeleton = page.locator(spec.skeleton).first();
	const ready = page.locator(spec.ready).first();

	let skeletonHeight: number | null = null;
	try {
		await skeleton.waitFor({ state: 'visible', timeout: 4_000 });
		if (spec.skeletonHeightSelectors?.length) {
			skeletonHeight = await measureSelectorsHeight(page, spec.skeletonHeightSelectors);
		} else {
			const box = await skeleton.boundingBox();
			skeletonHeight = box?.height ?? null;
		}
	} catch {
		/* Boot can be faster than delayed index on warm tabs — CLS still checked. */
	}

	await ready.waitFor({ state: 'visible', timeout: 20_000 });
	await expect(skeleton).toHaveCount(0, { timeout: 20_000 });

	const settleMs = spec.settleMs ?? 400;
	if (settleMs > 0) await page.waitForTimeout(settleMs);

	let readyHeight: number;
	if (spec.readyHeightSelectors?.length) {
		readyHeight = await measureSelectorsHeight(page, spec.readyHeightSelectors);
	} else {
		const readyBox = await ready.boundingBox();
		expect(readyBox, `${spec.id}: ready root missing`).not.toBeNull();
		readyHeight = readyBox!.height;
	}

	const maxHeightDelta = spec.maxHeightDeltaPx ?? DEFAULT_MAX_HEIGHT_DELTA;
	if (skeletonHeight != null && skeletonHeight > 0 && maxHeightDelta != null) {
		const delta = Math.abs(skeletonHeight - readyHeight);
		expect(
			delta,
			`${spec.id}: height jump ${delta.toFixed(0)}px (skel ${skeletonHeight.toFixed(0)} → ready ${readyHeight.toFixed(0)})`
		).toBeLessThanOrEqual(maxHeightDelta);
	}

	const cls = await readCls(page);
	expect(cls, `${spec.id}: CLS ${cls.toFixed(4)}`).toBeLessThanOrEqual(
		spec.maxCls ?? DEFAULT_MAX_CLS
	);
}

export async function seedGuestBoot(page: Page): Promise<void> {
	await seedGuestStorage(page);
}

/** Guest with no plans or history — for empty-state skeleton parity on /workouts. */
export async function seedEmptyWorkoutsBoot(page: Page): Promise<void> {
	await page.addInitScript(() => {
		localStorage.removeItem('repdraft:plans');
		localStorage.removeItem('repdraft:sessions');
		localStorage.removeItem('repdraft:active-session');
		document.documentElement.dataset.workoutsPlanRows = '0';
		document.documentElement.dataset.workoutsHistoryRows = '0';
		document.documentElement.dataset.homeRecentRows = '0';
		delete document.documentElement.dataset.homeActiveSession;
		document.cookie = 'repdraft_workouts_plan_rows=0; path=/; Max-Age=31536000; SameSite=Lax';
		document.cookie = 'repdraft_workouts_history_rows=0; path=/; Max-Age=31536000; SameSite=Lax';
		document.cookie = 'repdraft_home_has_history=; path=/; Max-Age=0; SameSite=Lax';
		document.cookie = 'repdraft_home_has_plans=; path=/; Max-Age=0; SameSite=Lax';
		document.cookie = 'repdraft_home_active=; path=/; Max-Age=0; SameSite=Lax';
	});
}
