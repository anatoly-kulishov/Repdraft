#!/usr/bin/env node
/**
 * Live History sheet + head actions overflow edge cases.
 * BASE_URL=http://127.0.0.1:5175 node scripts/e2e-live-history-overflow.mjs
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = (process.env.BASE_URL ?? 'http://127.0.0.1:5175').replace(/\/$/, '');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, '.tmp/e2e-live-history-overflow');

const VIEWPORTS = [
	{ id: 'se-320', width: 320, height: 568, isMobile: true, hasTouch: true },
	{ id: 'iphone-375', width: 375, height: 667, isMobile: true, hasTouch: true },
	{ id: 'iphone-390', width: 390, height: 844, isMobile: true, hasTouch: true }
];

const LONG_PLAN =
	'Супердлинное название плана тренировки без нормальных пробелов-для-переноса-WWWWWWWWWWWWWW';
const LONG_NOTE = 'ж'.repeat(80);

/** @type {{ id: string; viewport: string; ok: boolean; detail?: string; shot?: string }[]} */
const findings = [];

function pass(viewport, id, detail = '') {
	findings.push({ id, viewport, ok: true, detail });
}
function fail(viewport, id, detail, shot = '') {
	findings.push({ id, viewport, ok: false, detail, shot });
}

function seedPayload() {
	const now = Date.now();
	const iso = (offsetMs) => new Date(now - offsetMs).toISOString();
	const manySets = Array.from({ length: 16 }, (_, i) => ({
		weightKg: i % 2 === 0 ? 999.75 : 12.5,
		reps: i === 0 ? 500 : 12,
		completed: true,
		kind: 'work'
	}));

	const lastSessionSets = [
		{ weightKg: 80, reps: 8, completed: true, kind: 'work' },
		{ weightKg: 82.5, reps: 8, completed: true, kind: 'work' },
		{ weightKg: 85, reps: 6, completed: true, kind: 'work' },
		{ weightKg: 87.5, reps: 5, completed: true, kind: 'work' }
	];

	const sessions = [
		{
			id: 'hist-prev-source',
			planId: 'live-hist-plan',
			planName: LONG_PLAN,
			startedAt: iso(86_400_000),
			finishedAt: iso(86_400_000 - 3600_000),
			exercises: [
				{
					exerciseId: '0001',
					groupId: null,
					targetSets: 4,
					targetReps: 10,
					restSec: 60,
					sets: lastSessionSets
				}
			]
		},
		...Array.from({ length: 5 }, (_, i) => ({
			id: `hist-fat-${i}`,
			planId: 'live-hist-plan',
			planName: i === 0 ? LONG_PLAN : `Plan ${i} ${'X'.repeat(24)}`,
			startedAt: iso((i + 2) * 86_400_000),
			finishedAt: iso((i + 2) * 86_400_000 - 3600_000),
			exercises: [
				{
					exerciseId: '0001',
					groupId: null,
					targetSets: manySets.length,
					targetReps: 10,
					restSec: 60,
					sets: manySets
				}
			]
		}))
	];

	const active = {
		id: 'live-hist-active',
		planId: 'live-hist-plan',
		planName: LONG_PLAN,
		startedAt: iso(0),
		finishedAt: null,
		exercises: [
			{
				exerciseId: '0001',
				groupId: 'g-alt',
				targetSets: 4,
				targetReps: 10,
				restSec: 60,
				sets: [
					{ weightKg: 999.75, reps: 500, completed: true, kind: 'work' },
					{ weightKg: null, reps: null, completed: false, kind: 'work' },
					{ weightKg: null, reps: null, completed: false, kind: 'work' },
					{ weightKg: null, reps: null, completed: false, kind: 'work' }
				]
			},
			{
				exerciseId: '0002',
				groupId: 'g-alt',
				targetSets: 3,
				targetReps: 10,
				restSec: 60,
				sets: [
					{ weightKg: null, reps: null, completed: false, kind: 'work' },
					{ weightKg: null, reps: null, completed: false, kind: 'work' },
					{ weightKg: null, reps: null, completed: false, kind: 'work' }
				]
			},
			{
				exerciseId: '0003',
				groupId: null,
				targetSets: 2,
				targetReps: 10,
				restSec: 45,
				sets: [
					{ weightKg: null, reps: null, completed: false, kind: 'work' },
					{ weightKg: null, reps: null, completed: false, kind: 'work' }
				]
			}
		],
		altChoices: { 'g-alt': '0001' }
	};

	const plan = {
		id: 'live-hist-plan',
		name: LONG_PLAN,
		createdAt: iso(10 * 86_400_000),
		updatedAt: iso(0),
		exercises: [
			{ exerciseId: '0001', sets: 4, reps: 10, restSec: 60, groupId: 'g-alt' },
			{ exerciseId: '0002', sets: 3, reps: 10, restSec: 60, groupId: 'g-alt' },
			{ exerciseId: '0003', sets: 2, reps: 10, restSec: 45, groupId: null }
		]
	};

	return {
		plans: [plan],
		sessions,
		active,
		records: [
			{
				exerciseId: '0001',
				weightKg: 999.5,
				reps: 500,
				note: LONG_NOTE,
				updatedAt: iso(0)
			}
		]
	};
}

async function seed(page, payload) {
	await page.addInitScript((data) => {
		localStorage.setItem('repdraft.theme', 'dark');
		localStorage.setItem('repdraft.locale', 'ru');
		localStorage.setItem('repdraft:install-hint-dismissed', '1');
		localStorage.setItem(
			'repdraft:onboarding',
			JSON.stringify({
				checklistDismissed: true,
				checklist: {
					homeSeen: true,
					planReady: true,
					liveEntered: true,
					setLogged: true,
					sessionFinished: true
				},
				coachmarks: {
					'live.logging': true,
					'live.finish': true,
					'preview.start': true,
					'builder.intro': true
				},
				activatedAt: '2000-01-01T00:00:00.000Z',
				demoPlanInstalled: false,
				visitCount: 3
			})
		);
		localStorage.setItem('repdraft:plans', JSON.stringify(data.plans));
		localStorage.setItem('repdraft:sessions', JSON.stringify(data.sessions));
		localStorage.setItem('repdraft:active-session', JSON.stringify(data.active));
		localStorage.setItem('repdraft:records', JSON.stringify(data.records));
		localStorage.setItem('repdraft:sessions-deleted', JSON.stringify([]));
	}, payload);
}

async function scan(page) {
	return page.evaluate(() => {
		const vw = window.innerWidth;
		const rootBleed =
			document.documentElement.scrollWidth > vw + 1 || document.body.scrollWidth > vw + 1;

		function inRail(el) {
			let p = el.parentElement;
			while (p && p !== document.body) {
				const ox = getComputedStyle(p).overflowX;
				if (ox === 'auto' || ox === 'scroll') return true;
				p = p.parentElement;
			}
			return false;
		}

		const offenders = [];
		for (const el of document.querySelectorAll(
			'.live-panel, .live-panel *, .bottom-sheet__card, .bottom-sheet__card *, .live-panel-head, .live-panel-head__actions, .live-set-head, .exercise-history, .exercise-history *'
		)) {
			if (!(el instanceof HTMLElement)) continue;
			if (inRail(el)) continue;
			const r = el.getBoundingClientRect();
			if (r.width < 4 || r.height < 4) continue;
			if (r.right > vw + 2 || r.left < -2) {
				offenders.push({
					cls: typeof el.className === 'string' ? el.className.slice(0, 100) : el.tagName,
					left: Math.round(r.left),
					right: Math.round(r.right),
					w: Math.round(r.width)
				});
				if (offenders.length >= 10) break;
			}
		}

		const headBtns = [...document.querySelectorAll('.live-panel-head-btn')].map((el) => {
			const r = el.getBoundingClientRect();
			return {
				aria: el.getAttribute('aria-label')?.slice(0, 40) ?? '',
				w: Math.round(r.width),
				h: Math.round(r.height),
				ok: r.width >= 47.5 && r.height >= 47.5
			};
		});

		const doneAll = document.querySelector('.live-set-head-done');
		const doneRect = doneAll?.getBoundingClientRect();
		const doneOk = doneRect
			? { w: Math.round(doneRect.width), h: Math.round(doneRect.height), ok: doneRect.width >= 47.5 && doneRect.height >= 47.5 }
			: null;

		const sheet = document.querySelector('.bottom-sheet__card');
		const sheetInfo = sheet
			? {
					scrollH: sheet.scrollHeight,
					clientH: sheet.clientHeight,
					bodyScroll: document.querySelector('.live-history-sheet__body')?.scrollHeight ?? 0,
					planOverflow: [...document.querySelectorAll('.exercise-history__plan')].some((p) => {
						const r = p.getBoundingClientRect();
						return r.right > vw + 2;
					})
				}
			: null;

		return {
			vw,
			rootBleed,
			offenders,
			headBtns,
			doneOk,
			sheetInfo,
			bad: rootBleed || offenders.length > 0
		};
	});
}

async function shot(page, name) {
	const file = join(outDir, `${name}.png`);
	await page.screenshot({ path: file, fullPage: false });
	return file;
}

async function gotoLive(page) {
	await page.goto(`${BASE}/live/live-hist-plan`, {
		waitUntil: 'domcontentloaded',
		timeout: 30_000
	});
	await page.waitForSelector('.live-panel', { timeout: 20_000 });
	await page.waitForTimeout(400);
}

async function runVp(browser, vp, payload) {
	const context = await browser.newContext({
		viewport: { width: vp.width, height: vp.height },
		isMobile: vp.isMobile,
		hasTouch: vp.hasTouch,
		locale: 'ru-RU'
	});
	const page = await context.newPage();
	await seed(page, payload);
	await gotoLive(page);

	// 1) Head with History + Swap (+ Skip if present) + long title
	let s = await scan(page);
	if (s.bad) {
		fail(vp.id, 'live.head.overflow', JSON.stringify(s.offenders.slice(0, 5)), await shot(page, `${vp.id}-head`));
	} else {
		pass(vp.id, 'live.head.overflow');
	}
	if (s.headBtns.length < 1) {
		fail(vp.id, 'live.head.history-btn', 'missing head buttons');
	} else {
		const badBtn = s.headBtns.find((b) => !b.ok);
		badBtn
			? fail(vp.id, 'live.head.touch', JSON.stringify(s.headBtns))
			: pass(vp.id, 'live.head.touch', `${s.headBtns.length} btns`);
	}
	if (s.doneOk && !s.doneOk.ok) {
		fail(vp.id, 'live.done-all.touch', JSON.stringify(s.doneOk));
	} else if (s.doneOk) {
		pass(vp.id, 'live.done-all.touch');
	}

	// Previous column (different per-set labels) + fat weights
	const hasPrev = await page.locator('.live-set-head--prev, .live-set-row--prev').count();
	if (hasPrev > 0) {
		s = await scan(page);
		s.bad
			? fail(vp.id, 'live.prev-col.overflow', JSON.stringify(s.offenders.slice(0, 5)), await shot(page, `${vp.id}-prev`))
			: pass(vp.id, 'live.prev-col.overflow');
	} else {
		fail(vp.id, 'live.prev-col.overflow', 'previous column not shown');
	}

	// 2) Open History sheet with fat sessions
	const histByAria = page.locator('button[aria-label*="истори" i], button[aria-label*="history" i]');
	if ((await histByAria.count()) > 0) {
		await histByAria.first().click();
	} else {
		fail(vp.id, 'live.history-sheet.overflow', 'history button missing');
		await context.close();
		return;
	}
	await page.waitForSelector('.live-history-sheet__body, .exercise-history--plain', { timeout: 10_000 });
	await page.waitForTimeout(350);
	s = await scan(page);
	if (s.bad || s.sheetInfo?.planOverflow) {
		fail(
			vp.id,
			'live.history-sheet.overflow',
			JSON.stringify({ offenders: s.offenders.slice(0, 5), sheet: s.sheetInfo }),
			await shot(page, `${vp.id}-sheet`)
		);
	} else {
		pass(vp.id, 'live.history-sheet.overflow', `sessions bodyScroll=${s.sheetInfo?.bodyScroll}`);
	}

	// Body should scroll internally for many sets
	const bodyScrollable = await page.evaluate(() => {
		const body = document.querySelector('.live-history-sheet__body');
		if (!body) return false;
		return body.scrollHeight > body.clientHeight + 4;
	});
	bodyScrollable
		? pass(vp.id, 'live.history-sheet.scroll')
		: fail(vp.id, 'live.history-sheet.scroll', 'body not scrollable with 6×16 sets');

	// Close sheet
	await page.keyboard.press('Escape');
	await page.waitForTimeout(250);

	// 3) Empty history: switch to exercise without past sessions (0003)
	const nav = page.locator('.live-nav-item');
	const navCount = await nav.count();
	if (navCount >= 3) {
		await nav.nth(2).click();
		await page.waitForTimeout(400);
		await page.locator('button[aria-label*="истори" i], button[aria-label*="history" i]').first().click();
		await page.waitForTimeout(350);
		const empty = await page.locator('.exercise-history__hint').count();
		empty > 0
			? pass(vp.id, 'live.history-sheet.empty')
			: fail(vp.id, 'live.history-sheet.empty', 'no empty hint', await shot(page, `${vp.id}-empty`));
		s = await scan(page);
		s.bad
			? fail(vp.id, 'live.history-sheet.empty-overflow', JSON.stringify(s.offenders.slice(0, 3)))
			: pass(vp.id, 'live.history-sheet.empty-overflow');
		await page.keyboard.press('Escape');
		await page.waitForTimeout(200);
	}

	// 4) Huge input values on narrow + done-all still ok
	await nav.first().click();
	await page.waitForTimeout(300);
	const weight = page.locator('.live-set-row.is-current input.live-set-weight').first();
	const reps = page.locator('.live-set-row.is-current input.live-set-reps').first();
	if ((await weight.count()) > 0) {
		await weight.fill('9999.999');
		await reps.fill('9999');
		await page.waitForTimeout(150);
		s = await scan(page);
		s.bad
			? fail(vp.id, 'live.input-fat.overflow', JSON.stringify(s.offenders.slice(0, 4)), await shot(page, `${vp.id}-inputs`))
			: pass(vp.id, 'live.input-fat.overflow');
	}

	await context.close();
}

async function main() {
	await mkdir(outDir, { recursive: true });
	const payload = seedPayload();
	const browser = await chromium.launch();
	try {
		for (const vp of VIEWPORTS) {
			await runVp(browser, vp, payload);
		}
	} finally {
		await browser.close();
	}

	const failed = findings.filter((f) => !f.ok);
	const passed = findings.filter((f) => f.ok);
	await writeFile(join(outDir, 'report.json'), JSON.stringify({ base: BASE, passed: passed.length, failed: failed.length, findings }, null, 2));
	console.log(`\nLive history overflow ${BASE}`);
	console.log(`Passed ${passed.length} / ${findings.length}`);
	if (failed.length) {
		console.log('\nFAILURES:');
		for (const f of failed) {
			console.log(`  ✗ [${f.viewport}] ${f.id}: ${f.detail ?? ''}`);
			if (f.shot) console.log(`    shot ${f.shot}`);
		}
		process.exitCode = 1;
	} else {
		console.log('All edge checks passed.');
	}
}

main().catch((err) => {
	console.error(err);
	process.exitCode = 1;
});
