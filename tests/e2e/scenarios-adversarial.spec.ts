/**
 * Regression guards for /scenarios Confirmed adversarial findings (must pass).
 */
import { test, expect, type Page } from '@playwright/test';
import { gotoReady, seedGuestStorage } from './helpers/app-ready';

async function seedTesterMode(page: Page, on: boolean): Promise<void> {
	await page.addInitScript((enabled) => {
		if (enabled) localStorage.setItem('repdraft:tester-mode', '1');
		else localStorage.removeItem('repdraft:tester-mode');
	}, on);
}

async function openScenarios(page: Page): Promise<void> {
	await seedGuestStorage(page);
	await seedTesterMode(page, true);
	await gotoReady(page, '/scenarios');
	await page.locator('.scenarios-page__toc-link, .scenarios-doc').first().waitFor({
		state: 'visible',
		timeout: 15_000
	});
}

test.describe('Scenarios adversarial regressions', () => {
	test('A4: scenarios markdown is not a public static asset', async ({ request }) => {
		const res = await request.get('/content/user-scenarios.md');
		expect(res.status(), 'gated scenarios body must not be world-readable').not.toBe(200);
	});

	test('A7: jumpToSection does not write hash when target id is missing', async ({
		page
	}) => {
		await openScenarios(page);
		const wrote = await page.evaluate(() => {
			const link = document.querySelector<HTMLAnchorElement>('.scenarios-page__toc-link');
			if (!link) return { ok: false as const, hash: window.location.hash };
			const id = (link.getAttribute('href') ?? '').replace(/^#/, '');
			document.getElementById(id)?.remove();
			const before = window.location.hash;
			link.click();
			return {
				ok: true as const,
				before,
				hash: window.location.hash,
				expectedGhost: `#${id}`
			};
		});
		expect(wrote.ok).toBe(true);
		if (wrote.ok) {
			expect(wrote.hash).not.toBe(wrote.expectedGhost);
		}
	});

	test('A8: reduced-motion uses auto scroll behavior', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await openScenarios(page);
		const behavior = await page.evaluate(() => {
			const link = document.querySelector<HTMLAnchorElement>('.scenarios-page__toc-link');
			if (!link) return null;
			const id = (link.getAttribute('href') ?? '').replace(/^#/, '');
			const el = document.getElementById(id);
			if (!el) return null;
			let captured: ScrollBehavior | 'missing' = 'missing';
			const orig = el.scrollIntoView.bind(el);
			el.scrollIntoView = ((arg?: boolean | ScrollIntoViewOptions) => {
				if (arg && typeof arg === 'object' && 'behavior' in arg) {
					captured = arg.behavior ?? 'missing';
				}
				return orig(arg as ScrollIntoViewOptions);
			}) as typeof el.scrollIntoView;
			link.click();
			return captured;
		});
		expect(behavior).toBe('auto');
	});

	test('CSS: scenarios styles load on cold route', async ({ page }) => {
		await openScenarios(page);
		const hits = await page.evaluate(() => {
			const el = document.querySelector('.scenarios-page');
			if (!el) return 0;
			let n = 0;
			for (const sheet of Array.from(document.styleSheets)) {
				try {
					for (const rule of Array.from(sheet.cssRules ?? [])) {
						if (rule instanceof CSSStyleRule && rule.selectorText?.includes('scenarios-page')) {
							n += 1;
						}
					}
				} catch {
					/* cross-origin */
				}
			}
			return n;
		});
		expect(hits).toBeGreaterThan(0);
	});
});
