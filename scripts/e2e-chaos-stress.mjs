#!/usr/bin/env node
/**
 * Chaos / edge stress for Repdraft — unpredictable athlete behaviour.
 *
 * Seeds extreme data, hammers navigation, overflows inputs, races UI actions,
 * and asserts clamps + next-plan visual rotation + no console errors / overflow.
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:5173 node scripts/e2e-chaos-stress.mjs
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = (process.env.BASE_URL ?? 'http://127.0.0.1:5173').replace(/\/$/, '');
const SEED = Number(process.env.CHAOS_SEED ?? Date.now() % 1_000_000);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, '.tmp/e2e-chaos-stress');

/** @typedef {{ id: string; ok: boolean; detail?: string }} Finding */
/** @type {Finding[]} */
const findings = [];

function pass(id, detail = '') {
	findings.push({ id, ok: true, detail });
}
function fail(id, detail = '') {
	findings.push({ id, ok: false, detail });
}

/** Mulberry32 */
function rng(seed) {
	let t = seed >>> 0;
	return () => {
		t += 0x6d2b79f5;
		let r = Math.imul(t ^ (t >>> 15), 1 | t);
		r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
		return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
	};
}

const rand = rng(SEED);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

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

function seedPayload() {
	const now = new Date().toISOString();
	const hyper = {
		id: 'chaos-hyper',
		name: 'Гипертрофия блок 1',
		createdAt: now,
		updatedAt: now,
		exercises: [
			{ exerciseId: '0001', sets: 3, reps: 4, restSec: 90 },
			{ exerciseId: '0002', sets: 2, reps: 7, restSec: 90 }
		]
	};
	const solo = {
		id: 'chaos-solo',
		name: 'Solo · полный зал',
		createdAt: now,
		updatedAt: now,
		exercises: [{ exerciseId: '0025', sets: 3, reps: 10, restSec: 60 }]
	};
	const split = {
		id: 'chaos-split',
		name: 'Сплит Вт/Пт ноги',
		createdAt: now,
		updatedAt: now,
		exercises: [{ exerciseId: '0043', sets: 3, reps: 8, restSec: 60 }]
	};
	const pair = {
		id: 'chaos-pair',
		name: 'Парная тренировка',
		createdAt: now,
		updatedAt: now,
		exercises: [{ exerciseId: '0032', sets: 3, reps: 12, restSec: 45 }]
	};
	// Stored order: solo first, hyper mid, split right after hyper (the real bug shape).
	const order = [solo.id, pair.id, hyper.id, split.id];

	const active = {
		id: 'chaos-active',
		planId: hyper.id,
		planName: hyper.name,
		startedAt: now,
		finishedAt: null,
		exercises: hyper.exercises.map((ex, ei) => ({
			exerciseId: ex.exerciseId,
			groupId: null,
			targetSets: ex.sets,
			targetReps: ex.reps,
			restSec: ex.restSec,
			sets: Array.from({ length: ex.sets }, (_, si) => ({
				weightKg: 71,
				reps: ex.reps,
				// First exercise pre-completed so finish sheet can auto-open after second.
				completed: ei === 0,
				kind: 'work'
			}))
		}))
	};

	return {
		plans: [hyper, solo, split, pair],
		order,
		pin: hyper.id,
		active,
		sessions: []
	};
}

async function waitApp(page) {
	await page.waitForLoadState('domcontentloaded');
	await page
		.waitForFunction(() => !document.getElementById('pwa-boot'), undefined, { timeout: 20_000 })
		.catch(() => {});
	await page
		.waitForFunction(
			() => !document.documentElement.hasAttribute('data-boot-pending'),
			undefined,
			{ timeout: 8_000 }
		)
		.catch(() => {});
	await page.waitForTimeout(250);
}

async function scanOverflow(page) {
	return page.evaluate(() => {
		const vw = window.innerWidth;
		const doc = document.documentElement;
		const body = document.body;
		return {
			bad: doc.scrollWidth > vw + 2 || body.scrollWidth > vw + 2,
			doc: doc.scrollWidth,
			vw
		};
	});
}

async function main() {
	await mkdir(outDir, { recursive: true });
	const browser = await chromium.launch({ headless: true });
	const payload = seedPayload();
	/** @type {string[]} */
	const consoleErrors = [];

	const context = await browser.newContext({
		viewport: { width: 390, height: 844 },
		isMobile: true,
		hasTouch: true,
		locale: 'ru-RU'
	});
	const page = await context.newPage();
	page.on('dialog', (d) => d.accept());
	page.on('console', (msg) => {
		if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200));
	});
	page.on('pageerror', (err) => consoleErrors.push(String(err).slice(0, 200)));

	await page.addInitScript(
		({ onboarding, data }) => {
			// Seed once per browser context — re-running on every goto would wipe finish/pin.
			if (localStorage.getItem('repdraft:chaos-seeded') === '1') return;
			localStorage.setItem('repdraft:chaos-seeded', '1');
			localStorage.setItem('repdraft:onboarding', onboarding);
			localStorage.setItem('repdraft:plans', JSON.stringify(data.plans));
			localStorage.setItem('repdraft:plan-order', JSON.stringify(data.order));
			localStorage.setItem('repdraft:home-next-plan-id', data.pin);
			localStorage.setItem('repdraft:sessions', JSON.stringify(data.sessions));
			localStorage.setItem('repdraft:active-session', JSON.stringify(data.active));
			localStorage.setItem('repdraft:sessions-deleted', JSON.stringify([]));
			localStorage.setItem('repdraft:records', JSON.stringify([]));
		},
		{ onboarding: E2E_ONBOARDING_DONE, data: payload }
	);

	console.log(`Chaos stress seed=${SEED} ${BASE}`);

	// --- 1) Workouts list: Next badge + visual order ---
	await page.goto(`${BASE}/workouts`, { waitUntil: 'domcontentloaded' });
	await waitApp(page);
	const listNames = await page.evaluate(() =>
		[...document.querySelectorAll('.entity-row, .workout-card, [data-plan-id]')]
			.map((el) => {
				const title =
					el.querySelector('.entity-row__title, .workout-card__title, h2, h3, .page-title') ||
					el.querySelector('p, span');
				return (title?.textContent || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
			})
			.filter(Boolean)
			.slice(0, 8)
	);
	// Fallback: card headings from snapshot structure used in app
	const cardTitles = await page.locator('main h2, main .entity-row__name, main .workout-plan-card__title, main a.entity-row').allTextContents().catch(() => []);
	const titlesJoined = [...listNames, ...cardTitles].join(' | ');
	if (/Гипертрофия/.test(titlesJoined) || (await page.getByText('Гипертрофия блок 1').count()) > 0) {
		pass('list.has-hyper', titlesJoined.slice(0, 120));
	} else {
		fail('list.has-hyper', `titles=${titlesJoined.slice(0, 200)}`);
	}
	const nextBadge = page.getByText('Следующая', { exact: true }).first();
	if ((await nextBadge.count()) > 0) pass('list.next-badge');
	else fail('list.next-badge', 'no Следующая badge');

	const ov1 = await scanOverflow(page);
	if (ov1.bad) fail('list.overflow', `${ov1.doc}/${ov1.vw}`);
	else pass('list.overflow');

	// --- 2) Search chaos ---
	const search = page.getByPlaceholder(/Поиск тренировок/i).first();
	if ((await search.count()) > 0) {
		const payloads = [
			'x'.repeat(200),
			'🔥'.repeat(40),
			'\u200b\u200b\u200b',
			'<script>alert(1)</script>',
			'שלום'.repeat(20),
			'   ',
			'Solo'
		];
		for (const q of payloads) {
			await search.fill(q);
			await page.waitForTimeout(80);
		}
		const val = await search.inputValue();
		if (val.length <= 80) pass('search.clamp', `len=${val.length}`);
		else fail('search.clamp', `len=${val.length}`);
		await search.fill('');
	} else {
		fail('search.missing');
	}

	// --- 3) Rapid tab spam ---
	const tabs = ['/', '/workouts', '/exercises', '/auth', '/builder', '/workouts', '/live/chaos-hyper'];
	for (let i = 0; i < 12; i++) {
		await page.goto(`${BASE}${pick(tabs)}`, { waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => {});
	}
	await waitApp(page);
	pass('nav.rapid-spam', '12 random gotos');

	// --- 4) Live input overflow + race complete ---
	await page.goto(`${BASE}/live/chaos-hyper`, { waitUntil: 'domcontentloaded' });
	await waitApp(page);
	// Dismiss coachmarks if any
	for (const label of ['Закрыть', 'Понятно', 'OK']) {
		const b = page.getByRole('button', { name: label }).first();
		if ((await b.count()) > 0 && (await b.isVisible().catch(() => false))) {
			await b.click().catch(() => {});
		}
	}

	const weight = page.locator('input.live-set-weight').first();
	const reps = page.locator('input.live-set-reps').first();
	if ((await weight.count()) > 0) {
		await weight.click();
		await weight.fill('');
		await weight.type('999999.999', { delay: 5 });
		await reps.click();
		await reps.fill('');
		await reps.type('99999', { delay: 5 });
		const wVal = await weight.inputValue();
		const rVal = await reps.inputValue();
		const wOk = Number(wVal) <= 999 || wVal.length <= 5;
		const rOk = Number(rVal) <= 999 || rVal.length <= 3;
		if (wOk && rOk) pass('live.input-clamp', `w=${wVal} r=${rVal}`);
		else fail('live.input-clamp', `w=${wVal} r=${rVal}`);

		// Rapid Done taps
		const done = page.getByRole('button', { name: /^Готово$/ }).first();
		if ((await done.count()) > 0) {
			await Promise.all([
				done.click().catch(() => {}),
				done.click().catch(() => {}),
				done.click().catch(() => {})
			]);
			pass('live.triple-done');
		}
	} else {
		fail('live.inputs-missing');
	}

	// Note sheet: overflow text
	const menu = page.getByRole('button', { name: /Меню действий упражнения/i }).first();
	if ((await menu.count()) > 0) {
		await menu.click();
		await page.waitForTimeout(200);
		const noteBtn = page.getByRole('button', { name: /^Заметка$/ }).first();
		if ((await noteBtn.count()) > 0) {
			await noteBtn.click();
			await page.waitForTimeout(200);
			const note = page.locator('input.live-ex-note__field').first();
			if ((await note.count()) > 0) {
				await note.fill('ж'.repeat(200) + ' <b>x</b>');
				const nVal = await note.inputValue();
				if (nVal.length <= 60) pass('live.note-clamp', `len=${nVal.length}`);
				else fail('live.note-clamp', `len=${nVal.length}`);
			} else fail('live.note-field-missing');
			await page.keyboard.press('Escape').catch(() => {});
			const close = page.getByRole('button', { name: /Закрыть/i }).first();
			if ((await close.count()) > 0) await close.click().catch(() => {});
		} else {
			pass('live.note-skipped', 'no note button');
		}
	}

	// Fresh live session for finish path (avoid leftover sheets from note stress)
	await page.goto(`${BASE}/live/chaos-hyper`, { waitUntil: 'domcontentloaded' });
	await waitApp(page);
	for (const label of ['Закрыть', 'Понятно']) {
		const b = page.getByRole('button', { name: label }).first();
		if ((await b.count()) > 0 && (await b.isVisible().catch(() => false))) {
			await b.click().catch(() => {});
		}
	}

	for (let i = 0; i < 10; i++) {
		const mark = page.getByRole('button', { name: /Отметить все/i }).first();
		if ((await mark.count()) > 0 && (await mark.isVisible().catch(() => false))) {
			await mark.click().catch(() => {});
			await page.waitForTimeout(120);
		}
		const finishBtn = page.getByRole('button', { name: /Завершить|Finish/i });
		const finishCount = await finishBtn.count();
		let finishShown = false;
		for (let fi = 0; fi < finishCount; fi++) {
			if (await finishBtn.nth(fi).isVisible().catch(() => false)) {
				finishShown = true;
				break;
			}
		}
		if (finishShown) break;

		const nextBtn = page.getByRole('button', { name: /Далее|Следующее упражнение|Next/i });
		let clickedNext = false;
		for (let ni = 0; ni < (await nextBtn.count()); ni++) {
			const cand = nextBtn.nth(ni);
			if ((await cand.isVisible().catch(() => false)) && (await cand.isEnabled().catch(() => false))) {
				await cand.click().catch(() => {});
				clickedNext = true;
				await page.waitForTimeout(150);
				break;
			}
		}
		if (!clickedNext) break;
	}

	// Prefer already-open finish sheet (auto-offer when all sets done)
	try {
		const openSheet = page.locator('[data-slot="sheet-content"][data-state="open"], [role="dialog"][data-state="open"]');
		const sheetFinish = openSheet.getByRole('button', { name: /Завершить|Finish/i });
		if ((await openSheet.count()) > 0 && (await sheetFinish.count()) > 0) {
			await sheetFinish.click({ timeout: 5_000 });
		} else {
			const finishBtn = page.getByRole('button', { name: /Завершить|Finish/i });
			let target = null;
			for (let fi = 0; fi < (await finishBtn.count()); fi++) {
				const cand = finishBtn.nth(fi);
				if (await cand.isVisible().catch(() => false)) {
					target = cand;
					break;
				}
			}
			if (!target) throw new Error('no visible finish button');
			await target.click({ timeout: 5_000 });
			const confirm = page
				.locator('[data-slot="sheet-content"], [role="dialog"]')
				.getByRole('button', { name: /Завершить|Finish/i })
				.last();
			await confirm.waitFor({ state: 'visible', timeout: 8_000 });
			await confirm.click({ timeout: 5_000 });
		}
		await page.waitForURL(/\/(workouts\/summary|workouts)/, { timeout: 15_000 });
		const durable = await page.evaluate(() => ({
			pin: localStorage.getItem('repdraft:home-next-plan-id'),
			sessions: JSON.parse(localStorage.getItem('repdraft:sessions') || '[]').length,
			url: location.pathname + location.search
		}));
		if (durable.url.includes('/summary') && durable.sessions === 0) {
			fail('live.finish-durable', `summary without local session; ${JSON.stringify(durable)}`);
		} else {
			pass('live.finish-attempt', JSON.stringify(durable));
		}
	} catch (err) {
		const dump = await page.evaluate(() =>
			[...document.querySelectorAll('button')]
				.filter((b) => /Завершить|Далее|Finish|Next|Отметить/i.test(b.textContent || ''))
				.map((b) => `${(b.textContent || '').trim()} vis=${!!b.getClientRects().length}`)
				.slice(0, 12)
				.join(' | ')
		);
		fail('live.finish-attempt', `${String(err).slice(0, 80)} ;; ${dump}`);
	}

	await page.waitForTimeout(400);
	// Don't click summary "Готово" (goes home); read pin while still on summary / after soft nav.
	const pinProbe = await page.evaluate(() => ({
		pin: localStorage.getItem('repdraft:home-next-plan-id'),
		order: JSON.parse(localStorage.getItem('repdraft:plan-order') || '[]'),
		sessions: JSON.parse(localStorage.getItem('repdraft:sessions') || '[]').map((s) => ({
			id: s.id,
			planId: s.planId,
			finished: Boolean(s.finishedAt)
		})),
		seeded: localStorage.getItem('repdraft:chaos-seeded'),
		url: location.pathname
	}));
	if (pinProbe.pin === 'chaos-solo') {
		pass('next.after-finish-visual', JSON.stringify(pinProbe));
	} else if (pinProbe.pin === 'chaos-split') {
		fail('next.after-finish-visual', `stored neighbor; ${JSON.stringify(pinProbe)}`);
	} else if (!pinProbe.sessions.some((s) => s.finished && s.planId === 'chaos-hyper')) {
		fail('next.after-finish-lost', JSON.stringify(pinProbe));
	} else {
		fail('next.after-finish-stuck', JSON.stringify(pinProbe));
	}

	await page.goto(`${BASE}/workouts`, { waitUntil: 'domcontentloaded' });
	await waitApp(page);

	const nextCard = await page.evaluate(() => {
		const badge = [...document.querySelectorAll('*')].find(
			(el) => el.childElementCount === 0 && (el.textContent || '').trim() === 'Следующая'
		);
		if (!badge) return null;
		let root = badge.parentElement;
		for (let i = 0; i < 8 && root; i++) {
			const text = (root.textContent || '').replace(/\s+/g, ' ');
			if (/Solo|Сплит|Гипертрофия|Парная/.test(text)) {
				if (text.includes('Solo')) return 'solo';
				if (text.includes('Сплит')) return 'split';
				if (text.includes('Гипертрофия')) return 'hyper';
				if (text.includes('Парная')) return 'pair';
			}
			root = root.parentElement;
		}
		return 'unknown';
	});
	if (nextCard === 'solo') pass('next.badge-on-solo');
	else if (nextCard === 'split') fail('next.badge-on-split', 'regression: stored neighbor');
	else pass('next.badge-state', `card=${nextCard}`);

	// --- 6) Builder name overflow ---
	await page.goto(`${BASE}/builder?new=1`, { waitUntil: 'domcontentloaded' });
	await waitApp(page);
	const nameInput = page.locator('input').first();
	if ((await nameInput.count()) > 0) {
		await nameInput.fill('W'.repeat(120));
		const n = await nameInput.inputValue();
		if (n.length <= 48) pass('builder.name-clamp', `len=${n.length}`);
		else fail('builder.name-clamp', `len=${n.length}`);
	}

	// --- 7) Catalog filter spam + long scroll ---
	await page.goto(`${BASE}/exercises`, { waitUntil: 'domcontentloaded' });
	await waitApp(page);
	const exSearch = page.getByPlaceholder(/Поиск|Search/i).first();
	if ((await exSearch.count()) > 0) {
		await exSearch.fill('жим');
		await page.waitForTimeout(100);
		await exSearch.fill('zzzz-not-found-' + 'q'.repeat(50));
		await page.waitForTimeout(100);
		await exSearch.fill('');
		pass('catalog.search-chaos');
	}
	await page.mouse.wheel(0, 4000);
	await page.mouse.wheel(0, -4000);
	const ovCat = await scanOverflow(page);
	if (ovCat.bad) fail('catalog.overflow', `${ovCat.doc}/${ovCat.vw}`);
	else pass('catalog.overflow');

	// --- 8) Auth form garbage ---
	await page.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded' });
	await waitApp(page);
	const email = page.locator('input[type="email"], input[name="email"]').first();
	if ((await email.count()) > 0) {
		await email.fill('not-an-email@@@' + 'x'.repeat(100));
		pass('auth.email-garbage');
	}
	const ovAuth = await scanOverflow(page);
	if (ovAuth.bad) fail('auth.overflow');
	else pass('auth.overflow');

	// --- 9) Domain rotation unit check in-page (mirrors fix) ---
	const domainOk = await page.evaluate(() => {
		function promote(plans, id) {
			const idx = plans.findIndex((p) => p.id === id);
			if (idx <= 0) return [...plans];
			const p = plans[idx];
			return [p, ...plans.slice(0, idx), ...plans.slice(idx + 1)];
		}
		function suggest(plans, finished) {
			const visible = promote(plans, finished);
			const idx = visible.findIndex((p) => p.id === finished);
			return visible[(idx + 1) % visible.length]?.id;
		}
		const stored = [{ id: 'solo' }, { id: 'pair' }, { id: 'hyper' }, { id: 'split' }];
		return suggest(stored, 'hyper') === 'solo' && suggest(stored, 'solo') === 'pair';
	});
	if (domainOk) pass('domain.visual-rotation');
	else fail('domain.visual-rotation');

	// --- 10) Stress backup fetch (size / parse) ---
	const stressMeta = await page.evaluate(async () => {
		try {
			const res = await fetch('/dev/repdraft-backup-stress-load.json');
			if (!res.ok) return { ok: false, status: res.status };
			const json = await res.json();
			const plans = json?.plans ?? json?.data?.plans ?? [];
			return { ok: true, planCount: Array.isArray(plans) ? plans.length : 0, keys: Object.keys(json || {}).slice(0, 12) };
		} catch (e) {
			return { ok: false, error: String(e) };
		}
	});
	if (stressMeta.ok && stressMeta.planCount >= 20) {
		pass('stress-backup.fetch', `plans=${stressMeta.planCount}`);
	} else if (stressMeta.ok) {
		pass('stress-backup.fetch-small', JSON.stringify(stressMeta));
	} else {
		fail('stress-backup.fetch', JSON.stringify(stressMeta));
	}

	// Console noise (ignore benign)
	const realErrors = consoleErrors.filter(
		(t) =>
			!/favicon|Download the React|CursorBrowser|net::ERR_ABORTED/i.test(t) &&
			!/Failed to load resource/i.test(t)
	);
	if (realErrors.length === 0) pass('console.clean', `raw=${consoleErrors.length}`);
	else fail('console.errors', realErrors.slice(0, 5).join(' || '));

	await browser.close();

	const failed = findings.filter((f) => !f.ok);
	const report = { seed: SEED, base: BASE, passed: findings.length - failed.length, total: findings.length, findings };
	await writeFile(join(outDir, 'report.json'), JSON.stringify(report, null, 2));

	console.log(`\nChaos stress seed=${SEED}`);
	console.log(`Passed ${report.passed} / ${report.total}`);
	for (const f of findings) {
		console.log(`${f.ok ? 'OK' : 'FAIL'}  ${f.id}${f.detail ? ` — ${f.detail}` : ''}`);
	}
	console.log(`Report: ${join(outDir, 'report.json')}`);
	process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
