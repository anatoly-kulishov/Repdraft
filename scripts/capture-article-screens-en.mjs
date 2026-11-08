/**
 * Capture EN article screenshots (dark canonical; light card crops where originals are light).
 * Requires: npm run dev (default http://127.0.0.1:5174)
 *
 *   node scripts/capture-article-screens-en.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'static/images/articles/en');
const BASE = process.env.ARTICLE_SHOT_BASE ?? 'http://127.0.0.1:5174';
const CSV = join(ROOT, 'scripts/fixtures/import/hevy.csv');

/** Resolve playwright from NODE_PATH / nearby install without adding a repo dependency. */
async function loadPlaywright() {
	const candidates = [
		'playwright',
		pathToFileURL('/tmp/pw-article-en/node_modules/playwright/index.js').href,
		pathToFileURL(join(ROOT, 'node_modules/playwright/index.js')).href
	];
	for (const spec of candidates) {
		try {
			const mod = await import(spec);
			const pw = mod.chromium ? mod : mod.default;
			if (pw?.chromium) return pw;
		} catch {
			/* try next */
		}
	}
	throw new Error(
		'Install playwright: npm i playwright --prefix /tmp/pw-article-en'
	);
}

mkdirSync(OUT, { recursive: true });

function dayIso(daysAgo, hour = 18) {
	const d = new Date();
	d.setHours(hour, 0, 0, 0);
	d.setDate(d.getDate() - daysAgo);
	return d.toISOString();
}

function session(id, planName, daysAgo, exercises) {
	const startedAt = dayIso(daysAgo, 18);
	const finishedAt = dayIso(daysAgo, 19);
	return { id, planId: null, planName, startedAt, finishedAt, exercises };
}

function workSets(weight, reps, n) {
	return Array.from({ length: n }, () => ({ weightKg: weight, reps, completed: true }));
}

const SEEDED_SESSIONS = [
	session('shot-1', 'Push', 0, [
		{ exerciseId: '0025', targetSets: 3, targetReps: 8, restSec: 90, sets: workSets(60, 8, 3) },
		{ exerciseId: '0031', targetSets: 3, targetReps: 10, restSec: 90, sets: workSets(40, 10, 3) }
	]),
	session('shot-2', 'Pull', 2, [
		{ exerciseId: '0012', targetSets: 3, targetReps: 8, restSec: 90, sets: workSets(70, 8, 3) },
		{ exerciseId: '0040', targetSets: 3, targetReps: 10, restSec: 60, sets: workSets(25, 10, 3) }
	]),
	session('shot-3', 'Legs', 5, [
		{ exerciseId: '0055', targetSets: 4, targetReps: 6, restSec: 120, sets: workSets(100, 6, 4) }
	]),
	session('shot-4', 'Push', 9, [
		{ exerciseId: '0025', targetSets: 3, targetReps: 8, restSec: 90, sets: workSets(55, 8, 3) }
	]),
	session('shot-5', 'Pull', 12, [
		{ exerciseId: '0012', targetSets: 3, targetReps: 8, restSec: 90, sets: workSets(65, 8, 3) }
	])
];

const COACH_PREVIEW = {
	version: 1,
	inviteCode: 'AB12CD34',
	clients: [
		{
			displayName: 'Anna K.',
			link: {
				id: 'demo-link-1',
				coachUserId: 'local-coach',
				clientUserId: 'demo-client-1',
				status: 'active',
				createdAt: dayIso(10)
			},
			sessions: SEEDED_SESSIONS.slice(0, 3)
		},
		{
			displayName: 'James P.',
			link: {
				id: 'demo-link-2',
				coachUserId: 'local-coach',
				clientUserId: 'demo-client-2',
				status: 'active',
				createdAt: dayIso(20)
			},
			sessions: [SEEDED_SESSIONS[3]]
		}
	]
};

const AI_PLAN = {
	ok: true,
	provider: 'GigaChat',
	model: 'GigaChat',
	droppedUnknownIds: 0,
	plan: {
		name: 'Back and biceps',
		exercises: [
			{ exerciseId: '0027', sets: 4, reps: 8, restSec: 120 },
			{ exerciseId: '0180', sets: 3, reps: 10, restSec: 90 },
			{ exerciseId: '0031', sets: 3, reps: 10, restSec: 75 },
			{ exerciseId: '0165', sets: 3, reps: 12, restSec: 60 }
		]
	}
};

async function jpegShot(locator, file, opts = {}) {
	const buf = await locator.screenshot({ type: 'jpeg', quality: 82, ...opts });
	writeFileSync(join(OUT, file), buf);
	console.log('wrote', file, `(${buf.length} bytes)`);
}

async function prepare(context) {
	await context.addInitScript(
		({ sessions, coach }) => {
			localStorage.setItem('repdraft.locale', 'en');
			localStorage.setItem('repdraft.theme', 'dark');
			localStorage.setItem('repdraft:sessions', JSON.stringify(sessions));
			localStorage.setItem('repdraft:coach-preview', JSON.stringify(coach));
			document.cookie = 'repdraft.locale=en; path=/; Max-Age=31536000; SameSite=Lax';
			document.cookie = 'repdraft.theme=dark; path=/; Max-Age=31536000; SameSite=Lax';
		},
		{ sessions: SEEDED_SESSIONS, coach: COACH_PREVIEW }
	);
}

async function settle(page) {
	await page.waitForFunction(() => !document.documentElement.hasAttribute('data-boot-pending'), {
		timeout: 20000
	}).catch(() => {});
	await page.waitForTimeout(500);
}

async function goto(page, path) {
	await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
	await settle(page);
}

async function setTheme(page, theme) {
	await page.evaluate((t) => {
		localStorage.setItem('repdraft.theme', t);
		document.documentElement.dataset.theme = t;
		document.documentElement.classList.toggle('dark', t === 'dark');
		document.documentElement.style.colorScheme = t;
	}, theme);
	await page.waitForTimeout(200);
}

async function main() {
	const { chromium } = await loadPlaywright();
	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext({
		viewport: { width: 390, height: 844 },
		deviceScaleFactor: 1,
		isMobile: true,
		hasTouch: true
	});
	await prepare(context);
	const page = await context.newPage();

	await page.route('**/api/ai/plan', async (route) => {
		if (route.request().method() === 'GET') {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ ok: true, available: true, provider: 'GigaChat' })
			});
			return;
		}
		if (route.request().method() === 'POST') {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(AI_PLAN)
			});
			return;
		}
		await route.continue();
	});

	// 1) AI draft form
	await goto(page, '/ai');
	await setTheme(page, 'dark');
	await jpegShot(page, 'ai-draft-form.jpg', { fullPage: false });

	// 2) AI draft result
	const brief = page.locator('textarea, [contenteditable=true]').first();
	if (await brief.count()) {
		await brief.fill('Back and biceps, 45 min, barbell and cable');
	}
	await page.waitForTimeout(150);
	const generate = page.getByRole('button', { name: /Generate/i });
	if (await generate.count()) {
		await generate.click();
		await page.waitForSelector('#ai-draft-plan', { timeout: 8000 }).catch(() => {});
		await page.waitForTimeout(600);
	}
	await jpegShot(page, 'ai-draft-result.jpg', { fullPage: false });

	// 3) Progress
	await goto(page, '/progress');
	await setTheme(page, 'dark');
	await page.setViewportSize({ width: 390, height: 1300 });
	await page.waitForTimeout(400);
	await jpegShot(page, 'progress-screen.jpg', { fullPage: false });
	await page.setViewportSize({ width: 390, height: 844 });

	// 4) AI coach hints
	await goto(page, '/coach');
	await setTheme(page, 'dark');
	await page.setViewportSize({ width: 390, height: 1000 });
	await page.waitForTimeout(400);
	await jpegShot(page, 'ai-coach-hints.jpg', { fullPage: false });
	await page.setViewportSize({ width: 390, height: 844 });

	// 5) Coach clients cabinet (preview)
	await goto(page, '/clients');
	await setTheme(page, 'dark');
	await page.setViewportSize({ width: 390, height: 1000 });
	await page.waitForTimeout(400);
	await jpegShot(page, 'coach-clients.jpg', { fullPage: false });
	await page.setViewportSize({ width: 390, height: 844 });

	// 6-8) Light card crops via injected fixtures (auth-gated in real app)
	await setTheme(page, 'light');
	await page.evaluate(() => {
		document.body.innerHTML = '';
		document.body.style.margin = '0';
		document.body.style.background = '#f3f4f6';
		document.body.style.fontFamily =
			'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif';

		const iconUser =
			'<svg width="20" height="20" viewBox="0 0 256 256" fill="none" stroke="#6d28d9" stroke-width="16"><circle cx="128" cy="96" r="40"/><path d="M40 216c16-48 56-72 88-72s72 24 88 72"/><path d="M180 68l20 20 36-40"/></svg>';
		const iconUsers =
			'<svg width="20" height="20" viewBox="0 0 256 256" fill="none" stroke="#6d28d9" stroke-width="16"><circle cx="88" cy="100" r="32"/><circle cx="168" cy="100" r="32"/><path d="M16 208c12-40 44-60 72-60s60 20 72 60"/><path d="M96 208c12-40 44-60 72-60s60 20 72 60"/></svg>';
		const css = `
			.card{background:#fff;border-radius:16px;padding:16px;box-shadow:0 1px 2px rgba(0,0,0,.06);width:335px;border:1px solid #e5e7eb}
			.card--sheet{width:358px;padding:20px}
			.title{margin:0 0 12px;font-size:15px;font-weight:700;color:#111}
			.row{display:flex;gap:12px;align-items:flex-start}
			.row + .row{margin-top:12px;padding-top:12px;border-top:1px solid #e5e7eb}
			.icon{width:36px;height:36px;border-radius:10px;background:#ede9fe;display:grid;place-items:center;flex:0 0 auto}
			.name{margin:0;font-size:15px;font-weight:700;color:#111}
			.meta{margin:2px 0 0;font-size:13px;line-height:1.35;color:#6b7280}
			.danger{margin-top:16px;border:0;background:transparent;color:#b91c1c;font:inherit;font-weight:700;padding:0;cursor:pointer}
		`;
		const style = document.createElement('style');
		style.textContent = css;
		document.head.appendChild(style);

		const wrap = document.createElement('div');
		wrap.style.cssText = 'padding:24px;display:flex;flex-direction:column;gap:24px;align-items:flex-start';
		wrap.innerHTML = `
			<div id="coach-profile" class="card">
				<p class="title">Coach and clients</p>
				<div class="row">
					<div class="icon">${iconUser}</div>
					<div>
						<p class="name">My coach</p>
						<p class="meta">Coach connected</p>
					</div>
				</div>
				<div class="row">
					<div class="icon">${iconUsers}</div>
					<div>
						<p class="name">Coach dashboard</p>
					</div>
				</div>
			</div>
			<div id="my-coach" class="card card--sheet">
				<p class="title">My coach</p>
				<div class="row">
					<div class="icon">${iconUser}</div>
					<div>
						<p class="name">Anatoly</p>
						<p class="meta">Connected Mon, 3 days ago</p>
						<p class="meta">Workouts, sets, and records are visible to the coach.</p>
					</div>
				</div>
				<button type="button" class="danger">Disconnect</button>
			</div>
		`;
		document.body.appendChild(wrap);
	});
	await page.waitForTimeout(200);
	await jpegShot(page.locator('#coach-profile'), 'coach-client-profile.jpg');
	await jpegShot(page.locator('#my-coach'), 'coach-my-coach-sheet.jpg');

	// Real CSV import sheet from workouts empty state
	try {
		await goto(page, '/workouts');
		await setTheme(page, 'light');
		const input = page.locator('input[type=file]').first();
		if ((await input.count()) > 0) {
			await input.setInputFiles(CSV);
			await page.waitForTimeout(800);
			const sheet = page.locator('.bottom-sheet, [role=dialog]').first();
			if (await sheet.count()) {
				await jpegShot(sheet, 'import-csv-preview.jpg');
			}
		}
	} catch (err) {
		console.warn('live import sheet skipped:', err.message);
	}

	await browser.close();
	console.log('done →', OUT);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
