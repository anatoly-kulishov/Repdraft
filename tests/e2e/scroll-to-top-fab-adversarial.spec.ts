/**
 * Regression probes from adversarial review of ScrollToTopFab (bottom-left).
 */
import { test, expect, type Page } from '@playwright/test';
import { gotoReady, seedGuestStorage } from './helpers/app-ready';

async function padMainForScroll(page: Page, heightPx = 4000): Promise<void> {
	await page.evaluate((h) => {
		const main = document.getElementById('main-content');
		if (!main) return;
		let pad = document.getElementById('e2e-scroll-pad');
		if (!pad) {
			pad = document.createElement('div');
			pad.id = 'e2e-scroll-pad';
			pad.setAttribute('aria-hidden', 'true');
			main.appendChild(pad);
		}
		pad.style.height = `${h}px`;
	}, heightPx);
}

/** Keep + FAB visible (empty plans list hides it). Runs after guest seed clear. */
async function seedOnePlan(page: Page): Promise<void> {
	const now = new Date().toISOString();
	await page.addInitScript(
		({ now: ts }) => {
			const plan = {
				id: 'e2e-scroll-plan',
				name: 'E2E scroll plan',
				createdAt: ts,
				updatedAt: ts,
				exercises: [{ exerciseId: 'ex-squat', sets: 3, reps: 5, restSec: 90 }]
			};
			localStorage.setItem('repdraft:plans', JSON.stringify([plan]));
			document.cookie = 'repdraft_home_has_plans=1; path=/; Max-Age=31536000; SameSite=Lax';
			document.cookie =
				'repdraft_workouts_plan_rows=1; path=/; Max-Age=31536000; SameSite=Lax';
		},
		{ now }
	);
}

function scrollFab(page: Page) {
	return page.locator('.scroll-to-top-fab').first();
}

test.describe('ScrollToTopFab regression', () => {
	test.beforeEach(async ({ page }) => {
		await seedGuestStorage(page);
		await seedOnePlan(page);
	});

	test('click reaches document top on /workouts', async ({ page }, info) => {
		test.skip(!info.project.name.startsWith('mobile'), 'lg:hidden');
		await gotoReady(page, '/workouts');
		await padMainForScroll(page);
		const fab = scrollFab(page);

		await page.evaluate(() => window.scrollTo(0, 1200));
		await expect(fab).toHaveClass(/is-visible/, { timeout: 3000 });

		await fab.click();
		await page.waitForFunction(() => {
			const y = window.scrollY || document.documentElement.scrollTop || 0;
			return y < 8;
		}, undefined, { timeout: 5000 });

		const y = await page.evaluate(
			() => window.scrollY || document.documentElement.scrollTop || 0
		);
		expect(y).toBeLessThan(8);
	});

	test('hidden FAB is inert and does not keep focus', async ({ page }, info) => {
		test.skip(!info.project.name.startsWith('mobile'), 'lg:hidden');
		await gotoReady(page, '/workouts');
		await padMainForScroll(page);
		const fab = scrollFab(page);

		await page.evaluate(() => window.scrollTo(0, 0));
		await page.waitForTimeout(80);
		await expect(fab).not.toHaveClass(/is-visible/);
		await expect(fab).toHaveAttribute('aria-hidden', 'true');

		const focused = await page.evaluate(() => {
			const btn = document.querySelector('.scroll-to-top-fab') as HTMLElement | null;
			if (!btn) return { activeIsFab: true, inert: false };
			btn.focus();
			return {
				activeIsFab: document.activeElement === btn,
				inert: btn.hasAttribute('inert')
			};
		});

		expect(focused.inert).toBe(true);
		expect(focused.activeIsFab).toBe(false);
	});

	test('bottom matches AppFab when toast undo clearance is set', async ({ page }, info) => {
		test.skip(!info.project.name.startsWith('mobile'), 'lg:hidden');
		await gotoReady(page, '/workouts');
		await padMainForScroll(page);
		await expect(page.locator('.app-fab:not(.app-fab--hidden)')).toBeVisible();

		await page.evaluate(() => {
			document.documentElement.style.setProperty('--toast-undo-clearance', '4.75rem');
		});
		await page.waitForTimeout(250);

		const bottoms = await page.evaluate(() => {
			const left = document.querySelector('.scroll-to-top-fab');
			const right = document.querySelector('.app-fab:not(.app-fab--hidden)');
			if (!left || !right) return { error: 'missing' as const };
			const leftBottom = getComputedStyle(left).bottom;
			const rightBottom = getComputedStyle(right).bottom;
			const px = (v: string) => Number.parseFloat(v) || 0;
			return {
				error: null,
				leftBottom,
				rightBottom,
				deltaPx: Math.abs(px(leftBottom) - px(rightBottom))
			};
		});

		expect(bottoms.error).toBeNull();
		expect(
			bottoms.deltaPx,
			`left=${bottoms.leftBottom} right=${bottoms.rightBottom}`
		).toBeLessThan(2);
	});

	test('sits bottom-left, clear of Home tab and + FAB', async ({ page }, info) => {
		test.skip(!info.project.name.startsWith('mobile'), 'lg:hidden');
		await gotoReady(page, '/workouts');
		await padMainForScroll(page);
		const fab = scrollFab(page);
		await page.evaluate((y) => window.scrollTo(0, y), 900);
		await expect(fab).toHaveClass(/is-visible/, { timeout: 3000 });
		await expect(page.locator('.app-fab:not(.app-fab--hidden)')).toBeVisible();

		const geometry = await page.evaluate(() => {
			const fabEl = document.querySelector('.scroll-to-top-fab') as HTMLElement | null;
			const plus = document.querySelector(
				'.app-fab:not(.app-fab--hidden)'
			) as HTMLElement | null;
			const home = document.querySelector(
				'.shell-nav-tabbar a.tab-link[href="/"]'
			) as HTMLElement | null;
			if (!fabEl || !plus || !home) return { error: 'missing' as const };
			const a = fabEl.getBoundingClientRect();
			const b = home.getBoundingClientRect();
			const p = plus.getBoundingClientRect();
			const overlap = (x: DOMRect, y: DOMRect) => {
				const ix = Math.max(0, Math.min(x.right, y.right) - Math.max(x.left, y.left));
				const iy = Math.max(0, Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top));
				return ix * iy;
			};
			return {
				error: null,
				fabLeftOfPlus: a.right < p.left,
				homeOverlap: overlap(a, b),
				plusOverlap: overlap(a, p)
			};
		});

		expect(geometry.error).toBeNull();
		expect(geometry.fabLeftOfPlus).toBe(true);
		expect(geometry.homeOverlap ?? 1).toBe(0);
		expect(geometry.plusOverlap ?? 1).toBe(0);
	});
});
