import { test } from '@playwright/test';
import {
	assertSkeletonTransition,
	seedFinishedSession,
	seedGuestBoot,
	seedMinimalPlan,
	type SkeletonTransitionSpec
} from './helpers/skeleton-transition';

const CASES: SkeletonTransitionSpec[] = [
	{
		id: 'home-create',
		path: '/',
		skeleton: '.home-skeleton',
		ready: '.home-hero--guest, .home-header--mockup',
		maxHeightDeltaPx: 48,
		indexDelayMs: 600
	},
	{
		id: 'home-start',
		path: '/',
		skeleton: '.home-skeleton--start',
		ready: '.home-header--mockup',
		maxHeightDeltaPx: 64,
		indexDelayMs: 600,
		setup: async (page) => {
			await seedMinimalPlan(page);
		}
	},
	{
		id: 'workouts',
		path: '/workouts',
		skeleton: '.workouts-skeleton',
		ready: '.workouts-page .entity-list--cards',
		readyHeightSelectors: ['.workouts-page__search', '.workouts-page .entity-list--cards'],
		maxHeightDeltaPx: 80,
		indexDelayMs: 700,
		setup: async (page) => {
			await seedMinimalPlan(page);
		}
	},
	{
		id: 'builder',
		path: '/builder?new',
		skeleton: '.page-skeleton--builder',
		ready: '.builder-empty-state',
		maxHeightDeltaPx: 96,
		indexDelayMs: 500
	},
	{
		id: 'auth-guest',
		path: '/auth',
		skeleton: '.page-skeleton--auth-guest',
		ready: '.auth-page form',
		maxHeightDeltaPx: 120,
		maxCls: 0.15
	},
	{
		id: 'records',
		path: '/records',
		skeleton: '.records-skeleton',
		ready: '.records-page',
		maxHeightDeltaPx: null,
		indexDelayMs: 600
	},
	{
		id: 'workout-preview',
		path: '/workouts/e2e-skeleton-plan',
		skeleton: '.workout-preview[aria-busy="true"]',
		ready: '.workout-preview-list',
		readyHeightSelectors: ['section.workout-preview:not([aria-busy="true"])'],
		maxHeightDeltaPx: 140,
		indexDelayMs: 700,
		setup: async (page) => {
			await seedMinimalPlan(page);
		}
	},
	{
		id: 'live',
		path: '/live/e2e-skeleton-plan',
		skeleton: '.page-skeleton--live',
		ready: '.live-panel',
		maxHeightDeltaPx: 120,
		indexDelayMs: 700,
		setup: async (page) => {
			await seedMinimalPlan(page);
		}
	},
	{
		id: 'history-detail',
		path: '/workouts/history/e2e-skeleton-session',
		skeleton: '.page-skeleton--history',
		skeletonHeightSelectors: [
			'.history-detail-skeleton-head',
			'.history-detail-skeleton-desktop-head',
			'.history-detail-skeleton-meta',
			'.page-skeleton--history'
		],
		ready: '.history-detail',
		readyHeightSelectors: [
			'.history-detail__screen-header',
			'.history-detail .subroute-desktop-head',
			'.history-detail'
		],
		maxHeightDeltaPx: 260,
		indexDelayMs: 700,
		setup: async (page) => {
			const { planId, exerciseId } = await seedMinimalPlan(page);
			await seedFinishedSession(page, planId, exerciseId);
		}
	},
	{
		id: 'summary',
		path: '/workouts/summary?id=e2e-skeleton-session',
		skeleton: '.page-skeleton--summary',
		ready: '.summary-page',
		maxHeightDeltaPx: 320,
		indexDelayMs: 700,
		setup: async (page) => {
			const { planId, exerciseId } = await seedMinimalPlan(page);
			await seedFinishedSession(page, planId, exerciseId);
		}
	}
];

test.beforeEach(async ({ page }) => {
	await seedGuestBoot(page);
});

for (const spec of CASES) {
	test(`skeleton transition: ${spec.id}`, async ({ page }) => {
		test.setTimeout(45_000);
		await assertSkeletonTransition(page, spec);
	});
}
