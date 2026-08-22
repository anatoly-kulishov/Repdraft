#!/usr/bin/env node
/**
 * Overflow / layout stress for tester handoff.
 *
 * Seeds extreme local data, walks key routes across narrow→wide viewports,
 * and fails on document/body horizontal overflow or fixed chrome spilling
 * past the viewport. Intentional chip rails are allowlisted.
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:4176 node scripts/e2e-overflow-stress.mjs
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = (process.env.BASE_URL ?? 'http://127.0.0.1:4176').replace(/\/$/, '');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, '.tmp/e2e-overflow-stress');

const VIEWPORTS = [
	{ id: 'se-320', width: 320, height: 568, isMobile: true, hasTouch: true },
	{ id: 'android-360', width: 360, height: 740, isMobile: true, hasTouch: true },
	{ id: 'iphone-390', width: 390, height: 844, isMobile: true, hasTouch: true },
	{ id: 'plus-414', width: 414, height: 896, isMobile: true, hasTouch: true },
	{ id: 'tablet-768', width: 768, height: 1024, isMobile: true, hasTouch: true },
	{ id: 'desktop-1280', width: 1280, height: 800, isMobile: false, hasTouch: false }
];

const LONG_NAME =
	'Супердлинное название тренировки для проверки переполнения UI и обрезания текста в карточках списков';
const LONG_NOTE =
	'Очень длинная заметка к рекорду без пробелов-разрыва: ' + 'ж'.repeat(48) + ' конец';

/** @typedef {{ id: string; viewport: string; route: string; ok: boolean; detail?: string; screenshot?: string }} Finding */

/** @type {Finding[]} */
const findings = [];

function pass(viewport, route, id, detail = '') {
	findings.push({ id, viewport, route, ok: true, detail });
}

function fail(viewport, route, id, detail, screenshot = '') {
	findings.push({ id, viewport, route, ok: false, detail, screenshot });
}

function seedPayload() {
	const now = new Date().toISOString();
	const ids = ['0001', '0002', '0003', '0025', '0032', '0045', '0060', '0100', '0150', '0200'];
	const manyExercises = ids.map((exerciseId, i) => ({
		exerciseId,
		sets: i === 0 ? 12 : 3,
		reps: 10,
		restSec: 60,
		groupId: i < 2 ? 'g-stress' : null
	}));

	const planMany = {
		id: 'stress-plan-many',
		name: LONG_NAME,
		createdAt: now,
		updatedAt: now,
		exercises: manyExercises
	};
	const planShort = {
		id: 'stress-plan-short',
		name: 'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
		createdAt: now,
		updatedAt: now,
		exercises: [{ exerciseId: '0001', sets: 3, reps: 12, restSec: 45 }]
	};

	const fatSets = Array.from({ length: 12 }, (_, i) => ({
		weightKg: i === 0 ? 999.75 : 40 + i,
		reps: i === 1 ? 500 : 10,
		completed: i < 2,
		kind: 'work'
	}));

	const active = {
		id: 'stress-active',
		planId: planMany.id,
		planName: LONG_NAME,
		startedAt: now,
		finishedAt: null,
		exercises: [
			{
				exerciseId: '0001',
				groupId: 'g-stress',
				targetSets: 12,
				targetReps: 10,
				restSec: 60,
				sets: fatSets
			},
			{
				exerciseId: '0002',
				groupId: 'g-stress',
				targetSets: 3,
				targetReps: 10,
				restSec: 60,
				sets: [
					{ weightKg: null, reps: 10, completed: false, kind: 'work' },
					{ weightKg: null, reps: 10, completed: false, kind: 'work' },
					{ weightKg: null, reps: 10, completed: false, kind: 'work' }
				]
			}
		]
	};

	const finished = {
		...active,
		id: 'stress-finished',
		finishedAt: now,
		exercises: active.exercises.map((ex) => ({
			...ex,
			sets: ex.sets.map((s) => ({ ...s, completed: true }))
		}))
	};

	const emptyish = {
		id: 'stress-empty',
		planId: planShort.id,
		planName: 'Пустая/короткая',
		startedAt: now,
		finishedAt: now,
		exercises: [
			{
				exerciseId: '0003',
				groupId: null,
				targetSets: 1,
				targetReps: 10,
				restSec: 0,
				sets: [{ weightKg: null, reps: null, completed: false, kind: 'work' }]
			}
		]
	};

	return {
		plans: [planMany, planShort],
		sessions: [finished, emptyish],
		active,
		records: [
			{
				exerciseId: '0001',
				weightKg: 999.5,
				reps: 500,
				note: LONG_NOTE,
				updatedAt: now
			}
		]
	};
}

async function seedStorage(page, payload) {
	await page.addInitScript((data) => {
		localStorage.setItem('repdraft:plans', JSON.stringify(data.plans));
		localStorage.setItem('repdraft:sessions', JSON.stringify(data.sessions));
		localStorage.setItem('repdraft:active-session', JSON.stringify(data.active));
		localStorage.setItem('repdraft:records', JSON.stringify(data.records));
		localStorage.setItem('repdraft:sessions-deleted', JSON.stringify([]));
		localStorage.setItem('repdraft:locale', JSON.stringify('ru'));
	}, payload);
}

/**
 * Scan document + fixed chrome for horizontal overflow.
 * @param {import('playwright').Page} page
 */
async function scanOverflow(page) {
	return page.evaluate(() => {
		const vw = window.innerWidth;
		const doc = document.documentElement;
		const body = document.body;

		/** @param {Element | null} el */
		function rectInfo(el) {
			if (!el) return null;
			const r = el.getBoundingClientRect();
			const style = getComputedStyle(el);
			return {
				tag: el.tagName.toLowerCase(),
				cls: typeof el.className === 'string' ? el.className.slice(0, 80) : '',
				display: style.display,
				overflowX: style.overflowX,
				scrollW: el.scrollWidth,
				clientW: el.clientWidth,
				left: Math.round(r.left),
				right: Math.round(r.right),
				width: Math.round(r.width),
				spillsRight: r.right > vw + 1,
				spillsLeft: r.left < -1,
				scrollBleed: el.scrollWidth > el.clientWidth + 2
			};
		}

		const rootBleed = doc.scrollWidth > vw + 1 || body.scrollWidth > vw + 1;
		const fixedSel = [
			'.shell-nav-tabbar',
			'.sticky-actions',
			'.toast-stack',
			'.draft-dock',
			'.shell-header',
			'.live-rest',
			'.summary-page__done-sticky',
			'.app-fab'
		];
		const fixed = fixedSel
			.map((sel) => {
				const el = document.querySelector(sel);
				if (!el) return null;
				const info = rectInfo(el);
				if (!info || info.display === 'none') return null;
				return { sel, ...info };
			})
			.filter(Boolean);

		const fixedBad = fixed.filter((f) => f.spillsRight || f.spillsLeft);

		/** Elements inside overflow-x rails are expected to extend past the viewport. */
		function inHorizontalScrollRail(el) {
			let p = el.parentElement;
			while (p && p !== document.body) {
				const ox = getComputedStyle(p).overflowX;
				if (ox === 'auto' || ox === 'scroll') return true;
				p = p.parentElement;
			}
			return false;
		}

		// Wide children that stick out of the viewport (ignore allowlisted rails).
		/** @type {ReturnType<typeof rectInfo>[]} */
		const offenders = [];
		for (const el of document.querySelectorAll(
			'main *, .app-shell *, .sticky-actions *, .shell-nav-tabbar *, .panel, .entity-row, .live-panel, .page-title, h1, h2'
		)) {
			if (!(el instanceof HTMLElement)) continue;
			if (inHorizontalScrollRail(el)) continue;
			const r = el.getBoundingClientRect();
			if (r.width < 8 || r.height < 8) continue;
			if (r.right > vw + 2 || r.left < -2) {
				offenders.push(rectInfo(el));
				if (offenders.length >= 8) break;
			}
		}

		return {
			vw,
			docScrollW: doc.scrollWidth,
			bodyScrollW: body.scrollWidth,
			rootBleed,
			fixedBad,
			offenders,
			bad: rootBleed || fixedBad.length > 0 || offenders.length > 0
		};
	});
}

async function shot(page, name) {
	const file = join(outDir, `${name}.png`);
	await page.screenshot({ path: file, fullPage: false });
	return file;
}

/**
 * @param {import('playwright').Page} page
 * @param {string} viewport
 * @param {string} route
 * @param {string} label
 */
async function checkRoute(page, viewport, route, label) {
	const res = await page.goto(`${BASE}${route}`, {
		waitUntil: 'domcontentloaded',
		timeout: 30_000
	});
	await page.waitForTimeout(450);
	if (!res || res.status() >= 400) {
		fail(viewport, route, `${label}.status`, `HTTP ${res?.status()}`);
		return;
	}
	pass(viewport, route, `${label}.status`, `${res.status()}`);

	const scan = await scanOverflow(page);
	if (!scan.bad) {
		pass(viewport, route, `${label}.overflow`, `doc=${scan.docScrollW}/${scan.vw}`);
		return;
	}
	const file = await shot(page, `${viewport}__${label}`.replace(/[^\w.-]+/g, '_'));
	const detail = JSON.stringify({
		doc: `${scan.docScrollW}/${scan.vw}`,
		body: scan.bodyScrollW,
		fixedBad: scan.fixedBad,
		offenders: scan.offenders.slice(0, 5)
	}).slice(0, 900);
	fail(viewport, route, `${label}.overflow`, detail, file);
}

async function runViewport(browser, vp, payload) {
	const context = await browser.newContext({
		viewport: { width: vp.width, height: vp.height },
		isMobile: vp.isMobile,
		hasTouch: vp.hasTouch,
		locale: 'ru-RU'
	});
	const page = await context.newPage();
	page.on('dialog', (d) => d.accept());
	await seedStorage(page, payload);

	const routes = [
		['/', 'home'],
		['/exercises', 'exercises'],
		['/catalog/all', 'catalog-all'],
		['/catalog/chest', 'catalog-chest'],
		['/workouts', 'workouts'],
		['/workouts?tab=history', 'history'],
		['/workouts/stress-plan-many', 'preview-long'],
		['/builder', 'builder'],
		['/live/stress-plan-many', 'live-fat'],
		['/workouts/summary?id=stress-finished', 'summary'],
		['/workouts/history/stress-finished', 'history-detail'],
		['/records', 'records'],
		['/articles', 'articles'],
		['/auth', 'auth'],
		['/exercise/0001', 'exercise']
	];

	for (const [route, label] of routes) {
		await checkRoute(page, vp.id, route, label);
	}

	// Live interaction stress: huge inputs + complete-all header on narrow.
	if (vp.width <= 414) {
		await page.goto(`${BASE}/live/stress-plan-many`, {
			waitUntil: 'domcontentloaded',
			timeout: 30_000
		});
		await page.waitForTimeout(500);
		const weight = page.locator('input.live-set-weight').first();
		const reps = page.locator('input.live-set-reps').first();
		if ((await weight.count()) > 0) {
			await weight.fill('9999.999');
			await reps.fill('9999');
			await page.waitForTimeout(200);
			const scan = await scanOverflow(page);
			if (scan.bad) {
				const file = await shot(page, `${vp.id}__live-input-stress`);
				fail(
					vp.id,
					'/live/stress-plan-many',
					'live.input-stress.overflow',
					JSON.stringify(scan.offenders.slice(0, 4)).slice(0, 600),
					file
				);
			} else {
				pass(vp.id, '/live/stress-plan-many', 'live.input-stress.overflow');
			}
			const head = page.locator('button.live-set-head-done');
			if ((await head.count()) > 0) {
				await head.click().catch(() => null);
				await page.waitForTimeout(300);
				const after = await scanOverflow(page);
				after.bad
					? fail(
							vp.id,
							'/live/stress-plan-many',
							'live.done-all.overflow',
							JSON.stringify(after.offenders.slice(0, 3)).slice(0, 500),
							await shot(page, `${vp.id}__live-done-all`)
						)
					: pass(vp.id, '/live/stress-plan-many', 'live.done-all.overflow');
			}
		} else {
			fail(vp.id, '/live/stress-plan-many', 'live.input-stress.overflow', 'no inputs');
		}
	}

	await context.close();
}

async function main() {
	await mkdir(outDir, { recursive: true });
	const payload = seedPayload();
	const browser = await chromium.launch();
	try {
		for (const vp of VIEWPORTS) {
			await runViewport(browser, vp, payload);
		}
	} finally {
		await browser.close();
	}

	const failed = findings.filter((f) => !f.ok);
	const passed = findings.filter((f) => f.ok);
	const report = {
		base: BASE,
		at: new Date().toISOString(),
		passed: passed.length,
		failed: failed.length,
		failures: failed,
		checks: findings
	};
	await writeFile(join(outDir, 'report.json'), JSON.stringify(report, null, 2));

	console.log(`\nOverflow stress ${BASE}`);
	console.log(`Passed ${passed.length} / ${findings.length}`);
	if (failed.length) {
		console.log('\nFAILURES:');
		for (const f of failed) {
			console.log(`  ✗ [${f.viewport}] ${f.id} @ ${f.route}`);
			console.log(`    ${f.detail}`);
			if (f.screenshot) console.log(`    shot: ${f.screenshot}`);
		}
		console.log(`\nReport: ${join(outDir, 'report.json')}`);
		process.exit(1);
	}
	console.log('All overflow checks passed.');
	console.log(`Report: ${join(outDir, 'report.json')}`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
