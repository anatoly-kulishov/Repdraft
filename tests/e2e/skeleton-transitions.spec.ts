import { test } from '@playwright/test';
import {
	assertSkeletonTransition,
	seedActiveSession,
	seedFinishedSession,
	seedGuestBoot,
	seedBuilderDraftBoot,
	seedEmptyWorkoutsBoot,
	seedHomeRecentSessions,
	seedMinimalPlan,
	type SkeletonTransitionSpec
} from './helpers/skeleton-transition';

const CASES: SkeletonTransitionSpec[] = [
	{
		id: 'home-create',
		path: '/',
		skeleton: '.home-skeleton--create',
		ready: '.home-hero--guest, .home-header--mockup',
		skeletonHeightSelectors: [
			'.home-skeleton-checklist',
			'.home-skeleton-create-hero'
		],
		readyHeightSelectors: [
			'.onboarding-checklist',
			'.home-hero--guest:not(.home-skeleton-create-hero)'
		],
		maxHeightDeltaPx: 72,
		indexDelayMs: 600
	},
	{
		id: 'home-start',
		path: '/',
		skeleton: '.home-skeleton--start',
		ready: '.home-header--mockup, .home-continue-card',
		readyHeightSelectors: [
			'.home-header--mockup:not(.home-skeleton-mockup)',
			'.home-continue-card',
			'.home-dashboard-aside .home-section-head',
			'.home-dashboard-aside .entity-list'
		],
		skeletonHeightSelectors: [
			'.home-skeleton-top-card, .home-skeleton-continue-card',
			'.home-skeleton--start .home-skeleton-section-head',
			'.home-skeleton--start .home-skeleton-recent-list, .home-skeleton--start .home-skeleton-aside-card'
		],
		maxHeightDeltaPx: 72,
		indexDelayMs: 600,
		setup: async (page) => {
			const { planId, exerciseId } = await seedMinimalPlan(page);
			await seedHomeRecentSessions(page, planId, exerciseId, 3);
		}
	},
	{
		id: 'home-continue',
		path: '/',
		skeleton: '.home-skeleton--start',
		ready: '.home-continue-card',
		readyHeightSelectors: [
			'.home-continue-card',
			'.home-dashboard-aside .home-section-head',
			'.home-dashboard-aside .entity-list'
		],
		skeletonHeightSelectors: [
			'.home-skeleton-continue-card',
			'.home-skeleton--start .home-skeleton-section-head',
			'.home-skeleton--start .home-skeleton-recent-list'
		],
		maxHeightDeltaPx: 72,
		indexDelayMs: 600,
		setup: async (page) => {
			const { planId, exerciseId } = await seedMinimalPlan(page);
			await seedActiveSession(page, planId, exerciseId);
			await seedHomeRecentSessions(page, planId, exerciseId, 3);
		},
		reseed: { active: true, recentCount: 3 }
	},
	{
		id: 'workouts',
		path: '/workouts',
		skeleton: '.workouts-skeleton',
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
		maxHeightDeltaPx: 80,
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
		maxHeightDeltaPx: 72,
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
		maxHeightDeltaPx: 80,
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
		maxHeightDeltaPx: 96,
		indexDelayMs: 500
	},
	{
		id: 'builder-filled',
		path: '/builder',
		skeleton: '.page-skeleton--builder:not(.page-skeleton--builder-empty)',
		ready: '.builder-exercise-list:not(.builder-exercise-list--skeleton)',
		skeletonHeightSelectors: [
			'.builder-group-hint--skeleton',
			'.builder-exercise-list--skeleton',
			'.builder-skeleton-sticky'
		],
		readyHeightSelectors: ['.builder-group-hint', '.builder-exercise-list', '.builder-sticky-actions'],
		maxHeightDeltaPx: 120,
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
		maxHeightDeltaPx: 120,
		maxCls: 0.15
	},
	{
		id: 'records',
		path: '/exercises/records',
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
		skeleton: '.live-page--skeleton',
		skeletonHeightSelectors: [
			'.live-skeleton-head',
			'.live-mobile-meta',
			'.live-page--skeleton .live-nav',
			'.live-page--skeleton .live-panel'
		],
		ready: '.live-panel',
		readyHeightSelectors: [
			'.screen-header--live',
			'.live-mobile-meta',
			'.live-nav',
			'.live-panel'
		],
		readyGate: '.live-set-row',
		maxHeightDeltaPx: 120,
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
			'.history-detail-skeleton-desktop-head',
			'.history-detail-skeleton-meta',
			'.history-exercise-list--skeleton'
		],
		ready: '.history-detail:not(.history-detail--skeleton)',
		readyHeightSelectors: [
			'.history-detail__screen-header',
			'.history-detail .subroute-desktop-head',
			'.history-detail .page-lead',
			'.history-detail .history-exercise-list'
		],
		maxHeightDeltaPx: 120,
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
		skeleton: '.catalog-exercise-skeleton',
		ready: '.catalog-sections',
		skeletonHeightSelectors: [
			'.catalog-exercise-skeleton__count',
			'.catalog-exercise-skeleton__section-title',
			'.catalog-exercise-skeleton__grid'
		],
		readyHeightSelectors: [
			'.catalog-list-count',
			'.catalog-section__title',
			'.catalog-sections .catalog-grid'
		],
		maxHeightDeltaPx: 160,
		settleMs: 0,
		indexDelayMs: 700
	},
	{
		id: 'summary',
		path: '/workouts/summary?id=e2e-skeleton-session',
		skeleton: '.summary-page--skeleton',
		ready: '.summary-page:not(.summary-page--skeleton)',
		skeletonHeightSelectors: ['.summary-hero', '.summary-stats', '.summary-exercises-preview__item'],
		readyHeightSelectors: ['.summary-hero', '.summary-stats', '.summary-exercises-preview__item'],
		maxHeightDeltaPx: 96,
		readyGate: '.summary-exercises-preview__item',
		indexDelayMs: 700,
		setup: async (page) => {
			const { planId, exerciseId } = await seedMinimalPlan(page);
			await seedFinishedSession(page, planId, exerciseId);
		},
		reseed: { finishedSessionId: 'e2e-skeleton-session' }
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
