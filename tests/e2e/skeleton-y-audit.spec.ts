import { test, type Page } from '@playwright/test';
import {
	delayExerciseIndex,
	ensureWorkoutSeed,
	installLayoutShiftObserver,
	isolateGuestCloud,
	seedGuestBoot,
	seedBuilderDraftBoot,
	seedEmptyWorkoutsBoot,
	seedFinishedSession,
	seedHomeRecentSessions,
	seedMinimalPlan,
	type SkeletonTransitionSpec
} from './helpers/skeleton-transition';
import { waitAppReady } from './helpers/app-ready';

type AuditCase = SkeletonTransitionSpec & {
	id: string;
	skipRootCompare?: boolean;
	skipBlockYCompare?: boolean;
};

const CASES: AuditCase[] = [
	{
		id: 'home-create',
		path: '/',
		skeleton: '.home-skeleton--create',
		ready: '.home-hero--guest, .home-header--mockup',
		skeletonHeightSelectors: ['.home-skeleton-checklist', '.home-skeleton-create-hero'],
		readyHeightSelectors: [
			'.onboarding-checklist',
			'.home-hero--guest:not(.home-skeleton-create-hero)'
		],
		indexDelayMs: 600
	},
	{
		id: 'home-start',
		path: '/',
		skeleton: '.home-skeleton--start',
		ready: '.home-header--mockup, .home-continue-card',
		skeletonHeightSelectors: [
			'.home-skeleton-top-card, .home-skeleton-continue-card',
			'.home-skeleton--start .home-skeleton-section-head',
			'.home-skeleton--start .home-skeleton-recent-list, .home-skeleton--start .home-skeleton-aside-card'
		],
		readyHeightSelectors: [
			'.home-header--mockup:not(.home-skeleton-mockup)',
			'.home-continue-card',
			'.home-dashboard-aside .home-section-head',
			'.home-dashboard-aside .entity-list'
		],
		indexDelayMs: 600,
		setup: async (page) => {
			const { planId, exerciseId } = await seedMinimalPlan(page);
			await seedHomeRecentSessions(page, planId, exerciseId, 3);
		}
	},
	{
		id: 'workouts',
		path: '/workouts',
		skeleton: '.workouts-skeleton-list',
		ready: '.workouts-page .entity-list--cards',
		skeletonHeightSelectors: [
			'.workouts-page__header',
			'.workouts-skeleton-empty',
			'.workouts-page__search',
			'.workouts-skeleton-list'
		],
		readyHeightSelectors: [
			'.workouts-page__header',
			'.workouts-page__search',
			'.workouts-page .entity-list--cards',
			'.workouts-page .empty-state--centered'
		],
		indexDelayMs: 700,
		setup: async (page) => {
			await seedMinimalPlan(page);
		}
	},
	{
		id: 'workouts-empty',
		path: '/workouts',
		skeleton: '.workouts-skeleton[data-workouts-skeleton-variant="plans-empty"]',
		ready: '.workouts-page .empty-state--centered:not(.workouts-skeleton-empty)',
		skeletonHeightSelectors: ['.workouts-page__header', '.workouts-skeleton-empty'],
		readyHeightSelectors: [
			'.workouts-page__header',
			'.workouts-page .empty-state--centered:not(.workouts-skeleton-empty)'
		],
		indexDelayMs: 700,
		setup: async (page) => {
			await seedEmptyWorkoutsBoot(page);
		}
	},
	{
		id: 'workouts-history-empty',
		path: '/workouts?tab=history',
		skeleton: '.workouts-skeleton[data-workouts-skeleton-variant="history-empty"]',
		ready: '.workouts-page .empty-state--history:not(.workouts-skeleton-empty)',
		skeletonHeightSelectors: ['.workouts-skeleton-empty--history'],
		readyHeightSelectors: ['.workouts-page .empty-state--history:not(.workouts-skeleton-empty)'],
		indexDelayMs: 700,
		setup: async (page) => {
			await seedEmptyWorkoutsBoot(page);
		}
	},
	{
		id: 'builder',
		path: '/builder?new',
		skeleton: '.page-skeleton--builder-empty',
		ready: '.builder-empty-state:not(.builder-skeleton-empty)',
		skeletonHeightSelectors: ['.builder-skeleton-empty'],
		readyHeightSelectors: ['.builder-empty-state:not(.builder-skeleton-empty)'],
		indexDelayMs: 500
	},
	{
		id: 'builder-filled',
		path: '/builder',
		skeleton: '.soft-enter .builder-exercise-list--skeleton',
		ready: '.soft-enter .builder-exercise-list:not(.builder-exercise-list--skeleton)',
		skeletonHeightSelectors: [
			'.builder-group-hint--skeleton, .builder-coachmark-skeleton',
			'.builder-exercise-list--skeleton',
			'.builder-skeleton-sticky'
		],
		readyHeightSelectors: [
			'.builder-group-hint, .onboarding-coachmark:not(.builder-coachmark-skeleton)',
			'.builder-exercise-list',
			'.builder-page .sticky-actions:not(.builder-skeleton-sticky)'
		],
		indexDelayMs: 700,
		setup: async (page) => {
			await seedBuilderDraftBoot(page, 3);
		}
	},
	{
		id: 'auth-guest',
		path: '/auth',
		skeleton: '.page-skeleton--auth-guest',
		ready: '.auth-page form',
		indexDelayMs: 500
	},
	{
		id: 'records',
		path: '/exercises/records',
		skeleton: '.records-skeleton',
		ready: '.records-page',
		indexDelayMs: 600
	},
	{
		id: 'workout-preview',
		path: '/workouts/e2e-skeleton-plan',
		skeleton: '.workout-preview[aria-busy="true"]',
		ready: '.workout-preview-list',
		indexDelayMs: 700,
		setup: async (page) => {
			await seedMinimalPlan(page);
		}
	},
	{
		id: 'live',
		path: '/live/e2e-skeleton-plan',
		skeleton: '.live-page--skeleton .live-panel-wrap',
		skeletonHeightSelectors: ['.live-panel--skeleton'],
		ready: '.live-page .live-panel-wrap',
		readyHeightSelectors: ['.live-panel:not(.live-panel--skeleton)'],
		skipRootCompare: true,
		skipBlockYCompare: true,
		indexDelayMs: 700,
		setup: async (page) => {
			await seedMinimalPlan(page);
		}
	},
	{
		id: 'history-detail',
		path: '/workouts/history/e2e-skeleton-session',
		skeleton: '.history-detail--skeleton',
		skeletonHeightSelectors: [
			'.history-detail-skeleton-head',
			'.history-detail-skeleton-meta',
			'.history-exercise-list--skeleton'
		],
		ready: '.history-detail:not(.history-detail--skeleton)',
		readyHeightSelectors: [
			'.history-detail__screen-header',
			'.history-detail .page-lead',
			'.history-detail .history-exercise-list'
		],
		indexDelayMs: 700,
		setup: async (page) => {
			const { planId, exerciseId } = await seedMinimalPlan(page);
			await seedFinishedSession(page, planId, exerciseId);
		},
		reseed: { finishedSessionId: 'e2e-skeleton-session' }
	},
	{
		id: 'catalog-all-grid',
		path: '/catalog/all',
		skeleton: '.catalog-exercise-skeleton .catalog-section:first-child',
		ready: '.catalog-sections .catalog-section:first-child',
		skipRootCompare: true,
		skeletonHeightSelectors: [
			'.catalog-exercise-skeleton__count',
			'.catalog-exercise-skeleton .catalog-section:first-child .catalog-exercise-skeleton__section-title',
			'.catalog-exercise-skeleton .catalog-section:first-child .catalog-exercise-skeleton__grid'
		],
		readyHeightSelectors: [
			'.catalog-list-count',
			'.catalog-sections .catalog-section:first-child .catalog-section__title',
			'.catalog-sections .catalog-section:first-child .catalog-grid, .catalog-sections .catalog-section:first-child .catalog-exercise-list'
		],
		indexDelayMs: 700,
		settleMs: 400
	},
	{
		id: 'summary',
		path: '/workouts/summary?id=e2e-skeleton-session',
		skeleton: '.summary-page--skeleton',
		ready: '.summary-page:not(.summary-page--skeleton)',
		skipRootCompare: true,
		skeletonHeightSelectors: [
			'.summary-hero',
			'.summary-stats',
			'.summary-exercises-preview__item',
			'.summary-page__done-sticky'
		],
		readyHeightSelectors: [
			'.summary-hero',
			'.summary-stats',
			'.summary-exercises-preview__item',
			'.summary-page__done-sticky'
		],
		indexDelayMs: 700,
		setup: async (page) => {
			const { planId, exerciseId } = await seedMinimalPlan(page);
			await seedFinishedSession(page, planId, exerciseId);
		},
		reseed: { finishedSessionId: 'e2e-skeleton-session' }
	}
];

type Block = { selector: string; index: number; h: number; y: number; w: number };

async function measureBlocks(page: import('@playwright/test').Page, selectors: string[]): Promise<Block[]> {
	return page.evaluate((sels) => {
		return sels.flatMap((sel) =>
			[...document.querySelectorAll(sel)].map((el, index) => {
				const r = el.getBoundingClientRect();
				return {
					selector: sel,
					index,
					h: Math.round(r.height),
					y: Math.round(r.top),
					w: Math.round(r.width)
				};
			})
		);
	}, selectors);
}

const WARN_Y = 8;

async function auditOne(page: Page, spec: AuditCase) {
	await isolateGuestCloud(page);
	await installLayoutShiftObserver(page);
	try {
		await page.unroute('**/data/exercises.index.json');
	} catch {
		/* ok */
	}
	if (spec.indexDelayMs) await delayExerciseIndex(page, spec.indexDelayMs);
	if (spec.setup) await spec.setup(page);

	await page.goto(spec.path, { waitUntil: 'domcontentloaded', timeout: 30_000 });
	await waitAppReady(page);

	if (spec.reseed) {
		const indexRes = await page.request.get('/data/exercises.index.json');
		const index = (await indexRes.json()) as { id: string }[];
		const exerciseId = index[0]?.id ?? '0025';
		await ensureWorkoutSeed(page, {
			planId: 'e2e-skeleton-plan',
			exerciseId,
			...spec.reseed
		});
		await page.reload({ waitUntil: 'domcontentloaded' });
		await waitAppReady(page);
	}

	const skeleton = page.locator(spec.skeleton).first();
	let skelBlocks: Block[] = [];
	let skelRoot: { h: number; y: number } | null = null;
	try {
		await skeleton.waitFor({ state: 'visible', timeout: 4000 });
		if (spec.skeletonHeightSelectors?.length) {
			skelBlocks = await measureBlocks(page, spec.skeletonHeightSelectors);
		}
		const box = await skeleton.boundingBox();
		skelRoot = box ? { h: Math.round(box.height), y: Math.round(box.y) } : null;
	} catch {
		/* fast boot */
	}

	const ready = page.locator(spec.ready).first();
	await ready.waitFor({ state: 'visible', timeout: 20_000 });
	await page.waitForTimeout(spec.settleMs ?? 400);

	let readyBlocks: Block[] = [];
	if (spec.readyHeightSelectors?.length) {
		readyBlocks = await measureBlocks(page, spec.readyHeightSelectors);
	}
	const readyBox = await ready.boundingBox();
	const readyRoot = readyBox ? { h: Math.round(readyBox.height), y: Math.round(readyBox.y) } : null;

	const cls = await page.evaluate(() => (window as unknown as { __repdraftCls?: number }).__repdraftCls ?? 0);

	const flags: string[] = [];
	const rootDY = skelRoot && readyRoot ? readyRoot.y - skelRoot.y : null;
	const rootDH = skelRoot && readyRoot ? readyRoot.h - skelRoot.h : null;
	if (!spec.skipRootCompare) {
		if (rootDY != null && Math.abs(rootDY) > WARN_Y) flags.push(`root Δy=${rootDY}px`);
		if (rootDH != null && Math.abs(rootDH) > WARN_Y) flags.push(`root Δh=${rootDH}px`);
	}
	if (cls > 0.12) flags.push(`CLS=${cls.toFixed(4)}`);

	const maxLen = Math.max(skelBlocks.length, readyBlocks.length);
	for (let i = 0; i < maxLen; i += 1) {
		const s = skelBlocks[i];
		const r = readyBlocks[i];
		if (!s || !r) continue;
		const dY = r.y - s.y;
		const dH = r.h - s.h;
		if (!spec.skipBlockYCompare && Math.abs(dY) > WARN_Y) {
			flags.push(`[${i}] Δy=${dY}px (${s.selector}→${r.selector})`);
		}
		if (Math.abs(dH) > WARN_Y) flags.push(`[${i}] Δh=${dH}px`);
	}

	const skelSum = skelBlocks.reduce((a, b) => a + b.h, 0);
	const readySum = readyBlocks.reduce((a, b) => a + b.h, 0);

	return {
		status: flags.length ? 'WARN' : 'OK',
		flags,
		text:
			`${flags.length ? 'WARN' : 'OK'} ${spec.id}\n` +
			`  root: skel y=${skelRoot?.y ?? '-'} h=${skelRoot?.h ?? '-'} → ready y=${readyRoot?.y ?? '-'} h=${readyRoot?.h ?? '-'}\n` +
			(spec.skeletonHeightSelectors?.length
				? `  blocks sum: ${skelSum}px → ${readySum}px (Δ${readySum - skelSum}px)\n`
				: '') +
			`  CLS: ${cls.toFixed(4)}` +
			(flags.length ? `\n  ${flags.join('\n  ')}` : '')
	};
}

test.describe('skeleton Y audit @mobile-dark', () => {
	test.use({ viewport: { width: 414, height: 736 } });

	test.beforeEach(async ({ page }) => {
		await seedGuestBoot(page);
	});

	test('audit all pages', async ({ browser }) => {
		test.setTimeout(180_000);
		const report: string[] = [];
		let warnCount = 0;

		for (const spec of CASES) {
			const context = await browser.newContext({
				viewport: { width: 414, height: 736 },
				baseURL: 'http://127.0.0.1:5173'
			});
			const page = await context.newPage();
			await seedGuestBoot(page);
			try {
				const result = await auditOne(page, spec);
				report.push(result.text);
				if (result.status === 'WARN') warnCount += 1;
			} catch (err) {
				report.push(`FAIL ${spec.id}: ${String(err)}`);
				warnCount += 1;
			} finally {
				await context.close();
			}
		}

		console.log('\n=== Skeleton Y audit (414px) ===\n' + report.join('\n\n') + `\n\n${warnCount}/${CASES.length} with warnings`);
	});
});
