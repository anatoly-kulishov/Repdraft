import type { Page } from '@playwright/test';

/** Stable guest boot — onboarding complete so baseline e2e/visuals stay unchanged. */
const E2E_ONBOARDING_DONE = JSON.stringify({
	checklistDismissed: true,
	checklist: {
		homeSeen: true,
		planReady: true,
		liveEntered: true,
		setLogged: true,
		sessionFinished: true
	},
	coachmarks: {
		'preview.start': true,
		'live.logging': true,
		'live.finish': true,
		'builder.intro': true,
		'builder.superset': true,
		'workouts.preview': true,
		'exercises.search': true,
		'exercises.picker': true,
		'exercise.tabs': true,
		'records.empty': true,
		'history.detail': true,
		'draft.dock': true
	},
	activatedAt: '2000-01-01T00:00:00.000Z',
	demoPlanInstalled: false,
	visitCount: 3
});

/** Stable guest boot — dark theme, RU locale, no plans (predictable home). */
export async function seedGuestStorage(page: Page): Promise<void> {
	await page.addInitScript((onboardingDone) => {
		localStorage.setItem('repdraft.theme', 'dark');
		localStorage.setItem('repdraft.locale', 'ru');
		localStorage.setItem('repdraft:install-hint-dismissed', '1');
		localStorage.setItem('repdraft:onboarding', onboardingDone);
		// Init script runs on every navigation — seed destructive clears once per tab.
		if (sessionStorage.getItem('repdraft:e2e-seeded') === '1') return;
		sessionStorage.setItem('repdraft:e2e-seeded', '1');
		localStorage.removeItem('repdraft:plans');
		localStorage.removeItem('repdraft:draft');
		localStorage.removeItem('repdraft:local-cache-user');
		document.cookie = 'repdraft_home_has_plans=; path=/; Max-Age=0; SameSite=Lax';
		document.cookie = 'repdraft_auth_boot=; path=/; Max-Age=0; SameSite=Lax';
	}, E2E_ONBOARDING_DONE);
}

/** Wait for PWA boot splash removal and initial paint. */
export async function waitAppReady(page: Page): Promise<void> {
	await page.waitForFunction(() => !document.getElementById('pwa-boot'), undefined, {
		timeout: 20_000
	});
	await page.waitForLoadState('domcontentloaded');
	await page.waitForTimeout(350);
}

export async function gotoReady(page: Page, path: string): Promise<void> {
	await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 30_000 });
	await waitAppReady(page);
}

/** Hide tabbar / FAB animation noise for repeatable screenshots. */
export async function stabilizeChrome(page: Page): Promise<void> {
	await page.evaluate(() => {
		document.documentElement.classList.add('e2e-stable');
	});
}
