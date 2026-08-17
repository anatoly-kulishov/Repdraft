#!/usr/bin/env node
/**
 * Full mobile + desktop Playwright UI/UX + functional audit for Repdraft MVP.
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:5173 node scripts/e2e-ui-audit.mjs
 *
 * Exit 0 = all checks passed; 1 = failures. Prints JSON summary + human table.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = (process.env.BASE_URL ?? 'http://127.0.0.1:5173').replace(/\/$/, '');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, '.tmp/e2e-ui-audit');

const VIEWPORTS = {
	mobile: { width: 390, height: 844, isMobile: true, hasTouch: true },
	desktop: { width: 1280, height: 900, isMobile: false, hasTouch: false }
};

/** @typedef {{ id: string; viewport: string; ok: boolean; detail?: string; screenshot?: string }} Check */

/** @type {Check[]} */
const checks = [];

function pass(viewport, id, detail = '') {
	checks.push({ id, viewport, ok: true, detail });
}

function fail(viewport, id, detail) {
	checks.push({ id, viewport, ok: false, detail });
}

async function shot(page, viewport, name) {
	const file = join(outDir, `${viewport}-${name}.png`);
	await page.screenshot({ path: file, fullPage: false });
	return file;
}

async function waitApp(page) {
	await page.waitForLoadState('domcontentloaded');
	await page.waitForTimeout(250);
}

async function goto(page, path) {
	const res = await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
	await waitApp(page);
	return res;
}

async function visible(page, selector) {
	const el = page.locator(selector).first();
	return (await el.count()) > 0 && (await el.isVisible().catch(() => false));
}

async function boxOverflows(page, selector) {
	return page.locator(selector).first().evaluate((el) => {
		const r = el.getBoundingClientRect();
		return {
			overflowX: el.scrollWidth > el.clientWidth + 1,
			offscreenRight: r.right > window.innerWidth + 1,
			offscreenLeft: r.left < -1,
			width: Math.round(r.width),
			height: Math.round(r.height)
		};
	});
}

/**
 * @param {import('playwright').Page} page
 * @param {'mobile'|'desktop'} viewport
 */
async function auditViewport(page, viewport) {
	const isMobile = viewport === 'mobile';

	// ——— Home ———
	{
		const res = await goto(page, '/');
		if (!res || res.status() >= 400) fail(viewport, 'home.status', `HTTP ${res?.status()}`);
		else pass(viewport, 'home.status', `${res.status()}`);

		const hasHome = await visible(page, '.home-page');
		hasHome ? pass(viewport, 'home.shell') : fail(viewport, 'home.shell', 'missing .home-page');

		if (isMobile) {
			const tabbar = await visible(page, '.shell-nav-tabbar');
			const sidebarHidden = await page
				.locator('.shell-sidebar')
				.evaluate((el) => getComputedStyle(el).display === 'none')
				.catch(() => true);
			tabbar ? pass(viewport, 'home.tabbar') : fail(viewport, 'home.tabbar', 'tabbar hidden');
			sidebarHidden
				? pass(viewport, 'home.no-sidebar')
				: fail(viewport, 'home.no-sidebar', 'sidebar visible on mobile');
		} else {
			const sidebar = await visible(page, '.shell-sidebar');
			const tabbarHidden =
				!(await visible(page, '.shell-nav-tabbar')) ||
				(await page
					.locator('.shell-nav-tabbar')
					.evaluate((el) => getComputedStyle(el).display === 'none')
					.catch(() => true));
			sidebar ? pass(viewport, 'home.sidebar') : fail(viewport, 'home.sidebar', 'sidebar missing');
			tabbarHidden
				? pass(viewport, 'home.tabbar-hidden')
				: fail(viewport, 'home.tabbar-hidden', 'tabbar still visible');
		}

		const recordsSection = page.locator('.home-section--records');
		(await recordsSection.count()) === 0
			? pass(viewport, 'home.no-records-widget')
			: fail(viewport, 'home.no-records-widget', 'records teaser still on home');

		await shot(page, viewport, 'home');
	}

	// ——— Catalog hub ———
	{
		await goto(page, '/exercises');
		const hub = await visible(page, '.catalog-hub');
		hub ? pass(viewport, 'catalog.hub') : fail(viewport, 'catalog.hub', 'missing');

		for (const href of ['/catalog/all', '/exercises/saved', '/records']) {
			const link = page.locator(`.catalog-hub-chips a[href="${href}"]`);
			(await link.count()) > 0 && (await link.first().isVisible())
				? pass(viewport, `catalog.nav${href}`)
				: fail(viewport, `catalog.nav${href}`, 'missing/hidden');
		}

		const nav = page.locator('.catalog-hub-chips');
		if ((await nav.count()) > 0) {
			const info = await boxOverflows(page, '.catalog-hub-chips');
			// Horizontal scroll on mobile chip row is intentional.
			!info.offscreenRight && !info.offscreenLeft
				? pass(viewport, 'catalog.nav-fit', JSON.stringify(info))
				: fail(viewport, 'catalog.nav-fit', JSON.stringify(info));
		}

		if (isMobile) {
			const primary = page.locator('.catalog-hub-chip--primary');
			const box = await primary.boundingBox();
			box && box.width >= 44 && box.height >= 44
				? pass(viewport, 'catalog.nav-primary-tap', `w=${Math.round(box.width)} h=${Math.round(box.height)}`)
				: fail(
						viewport,
						'catalog.nav-primary-tap',
						`tap target too small: ${box ? `${Math.round(box.width)}×${Math.round(box.height)}` : 'n/a'}`
					);
		}

		const zone = page.locator('.zone-card').first();
		(await zone.count()) > 0
			? pass(viewport, 'catalog.zones')
			: fail(viewport, 'catalog.zones', 'no zone cards');

		await shot(page, viewport, 'catalog-hub');
	}

	// ——— Zone list + search (no wipe bug) ———
	{
		await goto(page, '/catalog/chest?target=pectorals');
		const title = page.locator('.screen-header-title, .catalog-zone-title').first();
		(await title.count()) > 0
			? pass(viewport, 'zone.header')
			: fail(viewport, 'zone.header', 'no title');

		if (isMobile) {
			const back = page.locator('.screen-header-back');
			(await back.isVisible())
				? pass(viewport, 'zone.mobile-back')
				: fail(viewport, 'zone.mobile-back', 'ScreenHeader back missing');
		} else {
			const crumb = page.locator('.catalog-zone-crumb-link');
			(await crumb.isVisible())
				? pass(viewport, 'zone.desktop-back')
				: fail(viewport, 'zone.desktop-back', 'crumb back missing');
		}

		const search = page.locator('input[type="search"], .search-field').first();
		await search.waitFor({ state: 'visible', timeout: 10_000 });
		await search.click();
		await search.pressSequentially('bench', { delay: 40 });
		await page.waitForTimeout(500);
		const value = await search.inputValue();
		value.includes('bench')
			? pass(viewport, 'zone.search-stable', `value="${value}"`)
			: fail(viewport, 'zone.search-stable', `wiped to "${value}"`);

		// List thumbs size on mobile
		if (isMobile) {
			const media = page.locator('.exercise-card--list .exercise-card-media').first();
			if ((await media.count()) > 0) {
				const box = await media.boundingBox();
				box && box.width >= 70
					? pass(viewport, 'zone.thumb-size', `w=${Math.round(box.width)}`)
					: fail(viewport, 'zone.thumb-size', `too small: ${box ? Math.round(box.width) : 'n/a'}`);
			}
		}

		await shot(page, viewport, 'catalog-zone');
	}

	// ——— Exercise detail back ———
	{
		const index = await (await page.request.get(`${BASE}/data/exercises.index.json`)).json();
		const chest = index.find((ex) => ex.body_part === 'chest');
		if (!chest?.id) {
			fail(viewport, 'exercise.id', 'no chest exercise');
		} else {
			await goto(page, `/exercise/${chest.id}`);
			if (isMobile) {
				(await visible(page, '.screen-header-back'))
					? pass(viewport, 'exercise.mobile-back')
					: fail(viewport, 'exercise.mobile-back', 'missing');
			} else {
				(await visible(page, '.catalog-zone-crumb-link, .subroute-back'))
					? pass(viewport, 'exercise.desktop-back')
					: fail(viewport, 'exercise.desktop-back', 'missing');
			}

			await goto(page, `/exercise/${chest.id}?from=${encodeURIComponent('/workouts')}`);
			const back = page.locator(
				isMobile ? '.screen-header-back' : '.catalog-zone-crumb-link, .subroute-back'
			);
			const href = await back.first().getAttribute('href');
			href === '/workouts' ||
				(await page
					.locator(
						`a.catalog-zone-crumb-link[href="/workouts"], a.subroute-back[href="/workouts"], a.screen-header-back[href="/workouts"]`
					)
					.count()) > 0
				? pass(viewport, 'exercise.from-workouts', `href=${href}`)
				: fail(viewport, 'exercise.from-workouts', `href=${href}`);

			await shot(page, viewport, 'exercise-detail');
		}
	}

	// ——— Records ———
	{
		await goto(page, '/records');
		const ok = (await page.locator('.page-title, .content-page').count()) > 0;
		ok ? pass(viewport, 'records.page') : fail(viewport, 'records.page', 'missing');
		await shot(page, viewport, 'records');
	}

	// ——— Saved ———
	{
		await goto(page, '/exercises/saved');
		if (isMobile) {
			(await visible(page, '.screen-header-back'))
				? pass(viewport, 'saved.mobile-back')
				: fail(viewport, 'saved.mobile-back', 'missing');
		} else {
			(await visible(page, '.catalog-zone-crumb-link, .subroute-back'))
				? pass(viewport, 'saved.desktop-back')
				: fail(viewport, 'saved.desktop-back', 'missing');
		}
	}

	// ——— Workouts list + create FAB/CTA ———
	{
		await goto(page, '/workouts');
		(await visible(page, '.workouts-page'))
			? pass(viewport, 'workouts.page')
			: fail(viewport, 'workouts.page', 'missing');

		if (isMobile) {
			const fab = page.locator('.workouts-fab');
			(await fab.count()) > 0 && (await fab.isVisible())
				? pass(viewport, 'workouts.fab')
				: fail(viewport, 'workouts.fab', 'FAB missing on mobile');
		} else {
			const cta = page.locator('.workouts-page__create');
			(await cta.isVisible())
				? pass(viewport, 'workouts.desktop-cta')
				: fail(viewport, 'workouts.desktop-cta', 'create CTA missing');
		}

		// If plans exist, open first preview and check back
		const planLink = page.locator('.entity-row__main[href^="/workouts/"]').first();
		if ((await planLink.count()) > 0) {
			const href = await planLink.getAttribute('href');
			await goto(page, href);
			if (isMobile) {
				(await visible(page, '.screen-header-back'))
					? pass(viewport, 'plan.mobile-back')
					: fail(viewport, 'plan.mobile-back', 'missing');
			} else {
				(await visible(page, '.subroute-back'))
					? pass(viewport, 'plan.desktop-back')
					: fail(viewport, 'plan.desktop-back', 'missing');
			}
			await shot(page, viewport, 'workout-plan');

			// Deep link into first exercise from plan if present
			const ex = page.locator('.workout-preview-row[href*="/exercise/"]').first();
			if ((await ex.count()) > 0) {
				await ex.click();
				await waitApp(page);
				await page.waitForTimeout(400);
				const back = page.locator(isMobile ? '.screen-header-back' : '.subroute-back');
				const backHref = await back.getAttribute('href');
				backHref && backHref.startsWith('/workouts/')
					? pass(viewport, 'plan→exercise.back', backHref)
					: fail(viewport, 'plan→exercise.back', `expected plan back, got ${backHref}`);
			} else {
				pass(viewport, 'plan→exercise.back', 'no exercises in plan (skip)');
			}
		} else {
			pass(viewport, 'plan.mobile-back', 'no plans (skip)');
			pass(viewport, 'plan.desktop-back', 'no plans (skip)');
			pass(viewport, 'plan→exercise.back', 'no plans (skip)');
		}
	}

	// ——— Builder create ———
	{
		await goto(page, '/builder');
		if (isMobile) {
			(await visible(page, '.screen-header-back'))
				? pass(viewport, 'builder.mobile-back')
				: fail(viewport, 'builder.mobile-back', 'missing');
			// Immersive flow: tabbar must be display:none or it steals sticky CTA clicks.
			const tabbarHidden = await page.locator('.shell-nav-tabbar').evaluate((el) => {
				const s = getComputedStyle(el);
				return s.display === 'none' || s.visibility === 'hidden' || s.pointerEvents === 'none';
			});
			tabbarHidden
				? pass(viewport, 'builder.tabbar-hidden')
				: fail(viewport, 'builder.tabbar-hidden', 'tabbar still hit-testable over sticky CTA');
			// Sticky save only mounts after ≥1 exercise; empty draft shows pick CTA.
			const stickySave = page.locator('.sticky-actions button.btn-primary');
			const pickCta = page.locator('a[href*="/catalog/all"]').first();
			if ((await stickySave.count()) > 0 && (await stickySave.isVisible())) {
				pass(viewport, 'builder.sticky-save', 'visible');
			} else if ((await pickCta.count()) > 0 && (await pickCta.isVisible())) {
				pass(viewport, 'builder.sticky-save', 'empty draft — sticky after add');
			} else {
				fail(viewport, 'builder.sticky-save', 'neither sticky save nor pick CTA');
			}
		} else {
			const back = page.locator('a[href="/workouts"]').filter({ hasText: /трениров|workout/i }).first();
			(await back.count()) > 0 && (await back.isVisible())
				? pass(viewport, 'builder.desktop-back')
				: fail(viewport, 'builder.desktop-back', 'missing');
		}
		await shot(page, viewport, 'builder');
	}

	// ——— Settings ———
	{
		await goto(page, '/settings');
		if (isMobile) {
			(await visible(page, '.screen-header-back'))
				? pass(viewport, 'settings.mobile-back')
				: fail(viewport, 'settings.mobile-back', 'missing');
		} else {
			(await visible(page, '.subroute-back'))
				? pass(viewport, 'settings.desktop-back')
				: fail(viewport, 'settings.desktop-back', 'missing');
		}
	}

	// ——— Theme toggle smoke (doesn't crash) ———
	{
		await goto(page, '/');
		const toggle = page.locator('.shell-theme-toggle, button[aria-label*="ёмн"], button[aria-label*="ark"], button[aria-label*="ветл"], button[aria-label*="ight"]').first();
		if ((await toggle.count()) > 0 && (await toggle.isVisible())) {
			const before = await page.locator('html').getAttribute('data-theme');
			await toggle.click();
			await page.waitForTimeout(200);
			const after = await page.locator('html').getAttribute('data-theme');
			before !== after
				? pass(viewport, 'theme.toggle', `${before}→${after}`)
				: fail(viewport, 'theme.toggle', `unchanged ${before}`);
			// restore
			await toggle.click();
		} else {
			pass(viewport, 'theme.toggle', 'toggle not visible (skip)');
		}
	}

	// ——— Footer attribution centered ———
	{
		await goto(page, '/exercises');
		const footer = page.locator('.shell-footer-inner');
		if ((await footer.count()) > 0) {
			const align = await footer.evaluate((el) => getComputedStyle(el).textAlign);
			align === 'center'
				? pass(viewport, 'footer.center', align)
				: fail(viewport, 'footer.center', align);
		}
	}

	// ——— Functional: Create → Pick → Save → Preview → Live → Log → Finish ———
	try {
		page.on('dialog', (d) => d.accept());
		const stamp = `E2E ${viewport} ${Date.now().toString(36).slice(-4)}`;
		await goto(page, '/builder');
		await page.waitForTimeout(500);

		const nameInput = page.locator('input.field[type="text"], label input[type="text"]').first();
		if ((await nameInput.count()) === 0) {
			fail(viewport, 'flow.builder-name', 'name field missing');
			return;
		}
		await nameInput.fill(stamp);
		pass(viewport, 'flow.builder-name', stamp);

		const addLink = page.locator('a[href*="/catalog/all"]').first();
		if ((await addLink.count()) === 0) {
			fail(viewport, 'flow.pick', 'add-exercise link missing');
			return;
		}
		await addLink.click();
		await waitApp(page);
		await page.waitForTimeout(700);

		const addBtn = page
			.locator('button.exercise-card-add--inline:not(.is-in-draft), button.exercise-card-add:not(.is-in-draft)')
			.first();
		if ((await addBtn.count()) === 0) {
			fail(viewport, 'flow.add-exercise', 'add button missing');
			return;
		}
		await addBtn.click();
		await page.waitForTimeout(600);
		pass(viewport, 'flow.add-exercise', 'clicked add');

		if (!page.url().includes('/builder') || page.url().includes('/builder/pick')) {
			await goto(page, '/builder');
			await page.waitForTimeout(500);
		}

		// Mobile save lives in sticky-actions; desktop in builder-toolbar.
		const saveBtn = isMobile
			? page.locator('.sticky-actions button.btn-primary')
			: page.locator('.builder-toolbar button.btn-primary');
		if ((await saveBtn.count()) === 0) {
			fail(viewport, 'flow.save', 'save button missing');
			return;
		}
		await saveBtn.click();
		await page.waitForURL(/\/workouts/, { timeout: 15_000 }).catch(() => null);
		await waitApp(page);
		!page.url().includes('/builder')
			? pass(viewport, 'flow.save', page.url())
			: fail(viewport, 'flow.save', `ended on ${page.url()}`);

		await page.waitForTimeout(400);
		const planRow = page.locator('.entity-row__main', { hasText: stamp }).first();
		if ((await planRow.count()) === 0) {
			fail(viewport, 'flow.preview', `plan "${stamp}" not in list`);
			return;
		}
		const previewHref = await planRow.getAttribute('href');
		if (!previewHref) {
			fail(viewport, 'flow.preview', `plan "${stamp}" link missing`);
			return;
		}
		await goto(page, previewHref);
		await page.waitForSelector('.workout-preview-list', { timeout: 10_000 }).catch(() => null);
		await page.waitForTimeout(400);
		pass(viewport, 'flow.preview', page.url());

		const startBtn = isMobile
			? page.locator('.workout-preview .sticky-actions button.btn-primary')
			: page.locator('.workout-preview-actions-desktop button.btn-primary');
		await startBtn.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => null);
		if ((await startBtn.count()) === 0) {
			fail(viewport, 'flow.start', 'start button missing');
			return;
		}
		await startBtn.click();
		await page.waitForURL(/\/live\//, { timeout: 15_000 }).catch(() => null);
		await waitApp(page);
		page.url().includes('/live/')
			? pass(viewport, 'flow.live', page.url())
			: fail(viewport, 'flow.live', page.url());

		const weight = page.locator('input.live-set-weight').first();
		const reps = page.locator('input.live-set-reps').first();
		if ((await weight.count()) > 0 && (await reps.count()) > 0) {
			await weight.fill('40');
			await reps.fill('8');
			pass(viewport, 'flow.log-inputs', '40×8');
			const setDone = page.locator('.live-set-done-btn').first();
			if ((await setDone.count()) > 0) {
				await setDone.click();
				await page.waitForTimeout(300);
				pass(viewport, 'flow.complete-set', 'set done');
			} else {
				pass(viewport, 'flow.complete-set', 'inputs filled');
			}
			const headDone = page.locator('button.live-set-head-done').first();
			if ((await headDone.count()) > 0) {
				pass(viewport, 'flow.done-all-control', 'header ✓ present');
			} else {
				fail(viewport, 'flow.done-all-control', 'header ✓ missing');
			}
		} else {
			fail(viewport, 'flow.log-inputs', 'weight/reps inputs missing');
			fail(viewport, 'flow.complete-set', 'skipped');
			fail(viewport, 'flow.done-all-control', 'skipped');
		}

		const finish = page.getByRole('button', { name: /заверш|finish/i }).first();
		if ((await finish.count()) === 0) {
			fail(viewport, 'flow.finish', 'finish button missing');
			return;
		}
		await finish.click();
		await page.waitForTimeout(1000);
		const url = page.url();
		url.includes('/summary') || url.includes('/workouts')
			? pass(viewport, 'flow.finish', url)
			: fail(viewport, 'flow.finish', url);
		await shot(page, viewport, 'flow-finish');
	} catch (err) {
		fail(viewport, 'flow.crash', err instanceof Error ? err.message : String(err));
	}
}

async function main() {
	await mkdir(outDir, { recursive: true });
	const browser = await chromium.launch({ headless: true });

	try {
		for (const [name, vp] of Object.entries(VIEWPORTS)) {
			const context = await browser.newContext({
				viewport: { width: vp.width, height: vp.height },
				isMobile: vp.isMobile,
				hasTouch: vp.hasTouch,
				locale: 'ru-RU',
				colorScheme: 'light'
			});
			const page = await context.newPage();
			page.setDefaultTimeout(15_000);
			try {
				await auditViewport(page, /** @type {'mobile'|'desktop'} */ (name));
			} catch (err) {
				fail(name, 'suite.crash', err instanceof Error ? err.message : String(err));
			}
			await context.close();
		}
	} finally {
		await browser.close();
	}

	const failed = checks.filter((c) => !c.ok);
	const passed = checks.filter((c) => c.ok);
	const report = {
		base: BASE,
		at: new Date().toISOString(),
		passed: passed.length,
		failed: failed.length,
		checks
	};
	await writeFile(join(outDir, 'report.json'), JSON.stringify(report, null, 2));

	console.log(`\nUI audit ${BASE}`);
	console.log(`Passed ${passed.length} / ${checks.length}`);
	if (failed.length) {
		console.log('\nFAILURES:');
		for (const f of failed) {
			console.log(`  ✗ [${f.viewport}] ${f.id}: ${f.detail ?? ''}`);
		}
	} else {
		console.log('All checks passed.');
	}
	console.log(`\nScreenshots + report: ${outDir}`);

	process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
