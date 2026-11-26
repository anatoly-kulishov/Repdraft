/**
 * Ad material: clean phone screens + composed cards (RU, dark).
 *
 *   node scripts/capture-ads.mjs            # build + serve + shoot everything
 *   ADS_SKIP_BUILD=1 node scripts/capture-ads.mjs
 *   ADS_BASE=http://127.0.0.1:4310 ADS_ONLY=clean node scripts/capture-ads.mjs
 *
 * The app boots in local-first guest mode (blank Supabase/AI env), the same way
 * Playwright e2e does, so seeded plans/sessions render without an account.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STAMP = process.env.ADS_STAMP ?? '2026-11-26';
const OUT = process.env.ADS_OUT ?? join(ROOT, 'marketing/ads', STAMP);
const PORT = Number(process.env.ADS_PORT ?? 4310);
const BASE = process.env.ADS_BASE ?? `http://127.0.0.1:${PORT}`;
const ONLY = process.env.ADS_ONLY ?? 'all';

/* ------------------------------------------------------------------ fixtures */

function dayIso(daysAgo, hour = 19, minute = 10) {
	const d = new Date();
	d.setHours(hour, minute, 0, 0);
	d.setDate(d.getDate() - daysAgo);
	return d.toISOString();
}

function plan(id, name, exercises, daysAgo = 28) {
	const ts = dayIso(daysAgo, 10);
	return { id, name, createdAt: ts, updatedAt: ts, exercises };
}

function ex(exerciseId, sets, reps, restSec, extra = {}) {
	return { exerciseId, sets, reps, restSec, ...extra };
}

function sets(weightKg, reps, count) {
	return Array.from({ length: count }, () => ({
		weightKg,
		reps,
		completed: true,
		kind: 'work'
	}));
}

/** Timed set: `reps` carries the duration; the unit lives on the exercise. */
function timedSets(value, count) {
	return Array.from({ length: count }, () => ({
		weightKg: null,
		reps: value,
		completed: true,
		kind: 'work'
	}));
}

const PLANS = [
	plan('plan-push', 'Жим · день A', [
		ex('0025', 4, 8, 120),
		ex('0091', 3, 10, 90),
		ex('0165', 3, 12, 60),
		ex('0225', 3, 12, 60)
	]),
	plan('plan-pull', 'Тяга · день B', [
		ex('3017', 4, 8, 120),
		ex('0293', 3, 10, 90),
		ex('0095', 3, 12, 75)
	]),
	plan('plan-legs', 'Ноги · день C', [
		ex('0043', 4, 6, 150),
		ex('0085', 3, 10, 120),
		ex('0054', 3, 12, 75)
	]),
	plan('plan-cardio', 'Кор + дорожка', [
		ex('0464', 3, 45, 45, { measure: 'seconds' }),
		ex('3665', 3, 30, 45, { measure: 'seconds' }),
		ex('0684', 1, 20, 0, { measure: 'minutes' })
	])
];

function session(id, planId, planName, daysAgo, exercises) {
	return {
		id,
		planId,
		planName,
		startedAt: dayIso(daysAgo, 19, 0),
		finishedAt: dayIso(daysAgo, 20, 5),
		exercises
	};
}

function sessionExercise(exerciseId, targetSets, targetReps, restSec, logged, extra = {}) {
	return { exerciseId, targetSets, targetReps, restSec, sets: logged, ...extra };
}

const SESSIONS = [
	session('s1', 'plan-legs', 'Ноги · день C', 1, [
		sessionExercise('0043', 4, 6, 150, sets(105, 6, 4)),
		sessionExercise('0085', 3, 10, 120, sets(85, 10, 3)),
		sessionExercise('0054', 3, 12, 75, sets(42.5, 12, 3))
	]),
	session('s2', 'plan-cardio', 'Кор + дорожка', 2, [
		sessionExercise('0464', 3, 45, 45, timedSets(45, 3), { measure: 'seconds' }),
		sessionExercise('3665', 3, 30, 45, timedSets(30, 3), { measure: 'seconds' }),
		sessionExercise('0684', 1, 20, 0, timedSets(20, 1), { measure: 'minutes' })
	]),
	session('s3', 'plan-push', 'Жим · день A', 3, [
		sessionExercise('0025', 4, 8, 120, sets(67.5, 8, 4)),
		sessionExercise('0091', 3, 10, 90, sets(37.5, 10, 3)),
		sessionExercise('0165', 3, 12, 60, sets(27.5, 12, 3)),
		sessionExercise('0225', 3, 12, 60, sets(12.5, 12, 3))
	]),
	session('s4', 'plan-pull', 'Тяга · день B', 5, [
		sessionExercise('3017', 4, 8, 120, sets(62.5, 8, 4)),
		sessionExercise('0293', 3, 10, 90, sets(30, 10, 3)),
		sessionExercise('0095', 3, 12, 75, sets(60, 12, 3))
	]),
	session('s5', 'plan-legs', 'Ноги · день C', 8, [
		sessionExercise('0043', 4, 6, 150, sets(100, 6, 4)),
		sessionExercise('0085', 3, 10, 120, sets(80, 10, 3)),
		sessionExercise('0054', 3, 12, 75, sets(40, 12, 3))
	]),
	session('s6', 'plan-push', 'Жим · день A', 10, [
		sessionExercise('0025', 4, 8, 120, sets(65, 8, 4)),
		sessionExercise('0091', 3, 10, 90, sets(35, 10, 3)),
		sessionExercise('0165', 3, 12, 60, sets(25, 12, 3)),
		sessionExercise('0225', 3, 12, 60, sets(10, 12, 3))
	]),
	session('s7', 'plan-pull', 'Тяга · день B', 12, [
		sessionExercise('3017', 4, 8, 120, sets(60, 8, 4)),
		sessionExercise('0293', 3, 10, 90, sets(28, 10, 3)),
		sessionExercise('0095', 3, 12, 75, sets(55, 12, 3))
	]),
	session('s8', 'plan-legs', 'Ноги · день C', 15, [
		sessionExercise('0043', 4, 6, 150, sets(95, 6, 4)),
		sessionExercise('0085', 3, 10, 120, sets(75, 10, 3)),
		sessionExercise('0054', 3, 12, 75, sets(37.5, 12, 3))
	])
];

const ATHLETE_PROFILE = {
	trainingPlace: 'gym',
	goals: ['muscle'],
	heightCm: 180,
	weightKg: 82,
	experience: 'regular',
	daysPerWeek: 4,
	sessionMinutes: 60,
	limits: ['none'],
	intakeCompletedAt: dayIso(40, 12)
};

const ONBOARDING = {
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
		'exercises.saved': true,
		'exercise.tabs': true,
		'exercise.bookmark': true,
		'exercise.historyEmpty': true,
		'bookmarks.empty': true,
		'records.empty': true,
		'history.detail': true,
		'draft.dock': true
	},
	activatedAt: dayIso(30, 20),
	demoPlanInstalled: false,
	visitCount: 24
};

/** Local Monday key a fortnight ago, so the cycle sits in the middle of a wave. */
function cycleStartDate() {
	const d = new Date();
	d.setHours(12, 0, 0, 0);
	d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - 14);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const CYCLE = {
	id: 'cycle-ads',
	name: 'Набор массы · 8 недель',
	createdAt: dayIso(20, 12),
	updatedAt: dayIso(2, 21),
	startDate: cycleStartDate(),
	weeks: 8,
	goal: 'muscle',
	planIds: ['plan-push', 'plan-pull', 'plan-legs', 'plan-cardio']
};

const SESSION_RATINGS = {
	s1: { stars: 5, at: dayIso(1, 20, 10) },
	s2: { stars: 4, at: dayIso(2, 20, 10) },
	s3: { stars: 5, at: dayIso(3, 20, 10) },
	s4: { stars: 4, at: dayIso(5, 20, 10) }
};

const STORAGE = {
	'repdraft.locale': 'ru',
	'repdraft.theme': 'dark',
	'repdraft:plans': PLANS,
	'repdraft:sessions': SESSIONS,
	'repdraft:cycle': CYCLE,
	'repdraft:athlete-profile': ATHLETE_PROFILE,
	'repdraft:onboarding': ONBOARDING,
	'repdraft:home-kit': ['dumbbell', 'band'],
	'repdraft:progress-period': 'month',
	'repdraft:session-ratings': SESSION_RATINGS
};

/* -------------------------------------------------------------------- browser */

async function loadPlaywright() {
	const mod = await import('playwright');
	const pw = mod.chromium ? mod : mod.default;
	if (!pw?.chromium) throw new Error('playwright is not installed');
	return pw;
}

function startServer() {
	const env = {
		...process.env,
		E2E_PORT: String(PORT),
		E2E_ORIGIN: BASE,
		E2E_SKIP_BUILD: process.env.ADS_SKIP_BUILD === '1' ? '1' : ''
	};
	const child = spawn(process.execPath, ['scripts/e2e-server.mjs'], {
		cwd: ROOT,
		env,
		stdio: ['ignore', 'pipe', 'pipe']
	});
	child.stdout.on('data', (b) => process.stdout.write(`[srv] ${b}`));
	child.stderr.on('data', (b) => process.stderr.write(`[srv] ${b}`));
	return child;
}

async function waitForServer(url, timeoutMs = 240_000) {
	const started = Date.now();
	while (Date.now() - started < timeoutMs) {
		try {
			const res = await fetch(`${url}/tools`);
			if (res.ok) return;
		} catch {
			/* not up yet */
		}
		await new Promise((r) => setTimeout(r, 700));
	}
	throw new Error(`server did not start on ${url}`);
}

async function seedContext(context) {
	await context.addInitScript((data) => {
		try {
			for (const [key, value] of Object.entries(data)) {
				localStorage.setItem(key, JSON.stringify(value));
			}
			localStorage.setItem('repdraft:pwa-installed', '1');
			localStorage.setItem('repdraft:install-hint-dismissed', '1');
			localStorage.setItem('repdraft:achievements-enabled', 'true');
			document.cookie = 'repdraft.locale=ru; path=/; Max-Age=31536000; SameSite=Lax';
			document.cookie = 'repdraft.theme=dark; path=/; Max-Age=31536000; SameSite=Lax';
		} catch {
			/* about:blank */
		}
	}, STORAGE);
}

async function settle(page) {
	await page
		.waitForFunction(() => !document.documentElement.hasAttribute('data-boot-pending'), {
			timeout: 20_000
		})
		.catch(() => {});
	await page.waitForTimeout(450);
	// Intro sheets / cookie notice can mount a tick later and would end up in the shot.
	for (let i = 0; i < 6; i += 1) {
		const ack = page.locator('.bottom-sheet button', { hasText: /^(Понятно|Хорошо|OK)$/ }).first();
		if (await ack.isVisible().catch(() => false)) {
			await ack.click({ timeout: 1_000 }).catch(() => {});
			continue;
		}
		const cookies = page.locator('.cookie-notice__button').first();
		if (await cookies.isVisible().catch(() => false)) {
			await cookies.click({ timeout: 1_000 }).catch(() => {});
			continue;
		}
		const backdrop = page.locator('.bottom-sheet__backdrop').first();
		if (await backdrop.isVisible().catch(() => false)) {
			await backdrop.click({ timeout: 1_000, force: true }).catch(() => {});
			continue;
		}
		break;
	}
	await page.waitForTimeout(250);
}

async function goto(page, path, { keepDraft = false } = {}) {
	if (!keepDraft) {
		await page
			.evaluate(() => {
				localStorage.removeItem('repdraft:draft');
				document.cookie = 'repdraft_builder_draft_rows=; path=/; Max-Age=0';
			})
			.catch(() => {});
	}
	await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
	await settle(page);
}

function ensureDir(...parts) {
	const dir = join(OUT, ...parts);
	mkdirSync(dir, { recursive: true });
	return dir;
}

async function shot(page, file, opts = {}) {
	const buf = await page.screenshot({ type: 'png', ...opts });
	writeFileSync(file, buf);
	console.log('  ->', file.replace(`${ROOT}/`, ''), `${Math.round(buf.length / 1024)} KB`);
}

/* --------------------------------------------------------------------- shots */

const PHONE = { width: 360, height: 800 };

async function captureClean(page, phoneDir) {
	const screens = [
		{ file: '01-home.png', path: '/' },
		{ file: '02-plan-cardio.png', path: '/workouts/plan-cardio' },
		{ file: '04-cycle.png', path: '/cycle', hideTabbar: true },
		{ file: '05-progress.png', path: '/progress', hideTabbar: true },
		{ file: '07-catalog.png', path: '/exercises' },
		{ file: '08-exercise-treadmill.png', path: '/exercise/0684' },
		{ file: '09-history.png', path: '/workouts/history/s1' },
		{ file: '10-workouts.png', path: '/workouts' }
	];

	for (const screen of screens) {
		await goto(page, screen.path);
		if (screen.hideTabbar) {
			await page.addStyleTag({ content: '.shell-nav-tabbar{display:none !important}' });
			await page.waitForTimeout(150);
		}
		await shot(page, join(phoneDir, screen.file));
	}

	// AI draft: the route is blanked in the hermetic build, so mock a plausible answer.
	await mockAiPlan(page);
	await goto(page, '/ai');
	const brief = page.locator('#ai-draft-brief');
	if (await brief.count()) {
		await brief.fill('Грудь и спина, 45 минут, штанга и блок');
		await page.waitForTimeout(200);
		await page.getByRole('button', { name: 'Сгенерировать' }).click();
		await page.waitForTimeout(900);
	}
	await shot(page, join(phoneDir, '06-ai-plan.png'));

	// Live: start the boot session, then run the plank stopwatch for ~3 seconds.
	await goto(page, '/live/plan-cardio');
	await page.waitForTimeout(600);
	const timer = page.locator('.live-set-timer').first();
	if (await timer.count()) {
		await timer.click();
		await page.waitForTimeout(3_250);
	} else {
		console.warn('  !! live timer not found');
	}
	await shot(page, join(phoneDir, '11-live-plank.png'));

	// Summary of the finished cardio session (seeded history).
	await goto(page, '/workouts/summary?id=s2');
	await shot(page, join(phoneDir, '12-summary.png'));

	// Builder last: opening it fills the draft dock, which would badge every later shot.
	await goto(page, '/builder/plan-cardio', { keepDraft: true });
	await shot(page, join(phoneDir, '03-builder-cardio.png'));
}

const AI_PLAN = {
	ok: true,
	provider: 'GigaChat',
	model: 'GigaChat',
	droppedUnknownIds: 0,
	plan: {
		name: 'Грудь и спина · 45 мин',
		exercises: [
			{ exerciseId: '0025', sets: 4, reps: 8, restSec: 120 },
			{ exerciseId: '3017', sets: 4, reps: 8, restSec: 120 },
			{ exerciseId: '0091', sets: 3, reps: 10, restSec: 90 },
			{ exerciseId: '0165', sets: 3, reps: 12, restSec: 60 }
		]
	}
};

/** The hermetic build blanks AI on purpose: mock the probe and the generation. */
async function mockAiPlan(page) {
	await page.route('**/api/ai/plan', async (route) => {
		if (route.request().method() === 'GET') {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ available: true, provider: 'GigaChat' })
			});
			return;
		}
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(AI_PLAN)
		});
	});
}

/* --------------------------------------------------------------------- cards */

function dataUri(file) {
	const buf = readFileSync(file);
	return `data:image/png;base64,${buf.toString('base64')}`;
}

const BRAND = {
	bg: '#0E0E11',
	text: '#ffffff',
	muted: '#a1a1a6',
	accent: '#a259ff',
	accentText: '#c4a3ff',
	muscle: '#3ee0c5'
};

const CARD_CSS = `
	*{box-sizing:border-box;margin:0;padding:0}
	html,body{background:${BRAND.bg};color:${BRAND.text};
		font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;
		-webkit-font-smoothing:antialiased}
	.stage{position:relative;overflow:hidden;background:
		radial-gradient(900px 700px at 82% -10%, rgba(162,89,255,.42), transparent 62%),
		radial-gradient(700px 600px at -12% 108%, rgba(62,224,197,.16), transparent 60%),
		${BRAND.bg};
		display:flex}
	.grain{position:absolute;inset:0;opacity:.05;pointer-events:none;
		background-image:radial-gradient(rgba(255,255,255,.7) 1px, transparent 1px);
		background-size:3px 3px}
	.kicker{display:flex;align-items:center;gap:14px;font-size:19px;font-weight:800;
		letter-spacing:.16em;text-transform:uppercase;color:${BRAND.accentText}}
	.kicker i{width:34px;height:2px;background:${BRAND.accent};display:block;border-radius:2px}
	h1{font-weight:850;letter-spacing:-.035em;line-height:1.02}
	p.sub{color:${BRAND.muted};line-height:1.38;font-weight:500}
	.cta{display:inline-flex;align-items:center;gap:14px;border-radius:999px;
		padding:20px 34px;font-weight:800;font-size:24px;color:#fff;
		background:linear-gradient(135deg,#8a2be2,${BRAND.accent});
		box-shadow:0 22px 60px rgba(138,43,226,.42)}
	.cta span{opacity:.72;font-weight:600}
	.chip{display:inline-flex;align-items:center;gap:10px;padding:11px 18px;border-radius:999px;
		background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);
		font-size:19px;font-weight:700;color:${BRAND.muted}}
	.chip b{color:${BRAND.text}}
	.phone{position:relative;border-radius:56px;padding:13px;
		background:linear-gradient(160deg,#3a3a40,#141418 52%,#26262c);
		box-shadow:0 50px 130px rgba(0,0,0,.72), inset 0 0 0 1px rgba(255,255,255,.16)}
	.phone .screen{position:relative;border-radius:44px;overflow:hidden;background:#000}
	.phone .screen img{display:block;width:100%;height:100%;object-fit:cover;object-position:top center}
	.phone .glare{position:absolute;inset:13px;border-radius:44px;pointer-events:none;
		background:linear-gradient(115deg,rgba(255,255,255,.10),transparent 34%)}
	.stack{position:relative}
	.stack .back{position:absolute;filter:brightness(.72) saturate(.9)}
`;

async function composeCard(page, size, html, file) {
	await page.setViewportSize(size);
	await page.setContent(
		`<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>${CARD_CSS}</style></head><body>${html}</body></html>`,
		{ waitUntil: 'load' }
	);
	await page.waitForTimeout(250);
	const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
	writeFileSync(file, buf);
	console.log('  ->', file.replace(`${ROOT}/`, ''), `${Math.round(buf.length / 1024)} KB`);
}

function phone(src, w, extraStyle = '') {
	return `<div class="phone" style="width:${w}px;${extraStyle}">
		<div class="screen" style="height:${Math.round((w - 26) * (2400 / 1080))}px">
			<img src="${src}" alt="">
			<div class="glare"></div>
		</div>
	</div>`;
}

async function captureCards(page, cleanDir, dirs) {
	const live = dataUri(join(cleanDir, '11-live-plank.png'));
	const home = dataUri(join(cleanDir, '01-home.png'));
	const cycle = dataUri(join(cleanDir, '04-cycle.png'));
	const progress = dataUri(join(cleanDir, '05-progress.png'));
	const plan = dataUri(join(cleanDir, '02-plan-cardio.png'));
	const ai = dataUri(join(cleanDir, '06-ai-plan.png'));

	const post = (inner) =>
		`<div class="stage" style="width:1080px;height:1350px;padding:72px 76px">${inner}<div class="grain"></div></div>`;

	await composeCard(
		page,
		{ width: 1080, height: 1350 },
		post(`
			<div style="display:flex;gap:44px;align-items:center;width:100%">
				<div style="flex:1;display:flex;flex-direction:column;gap:26px">
					<div class="kicker"><i></i>Тренировки</div>
					<h1 style="font-size:64px">Планка —<br>по секундомеру</h1>
					<p class="sub" style="font-size:30px;max-width:400px">Нажал «старт» — приложение само запишет время подхода. Дорожка — по минутам.</p>
					<div style="display:flex;gap:12px;flex-wrap:wrap">
						<div class="chip"><b>45 сек</b> планка</div>
						<div class="chip"><b>20 мин</b> дорожка</div>
					</div>
				</div>
				${phone(live, 380, 'flex:0 0 auto;transform:rotate(-3deg)')}
			</div>`),
		join(dirs.posts, 'post-1-plank-stopwatch-1080x1350.jpg')
	);

	await composeCard(
		page,
		{ width: 1080, height: 1350 },
		post(`
			<div style="display:flex;flex-direction:column;gap:34px;width:100%">
				<div style="display:flex;align-items:flex-end;justify-content:space-between;gap:30px">
					<div style="display:flex;flex-direction:column;gap:20px">
						<div class="kicker"><i></i>Цикл</div>
						<h1 style="font-size:70px">Нагрузка<br>волнами</h1>
						<p class="sub" style="font-size:28px;max-width:520px">Объём, интенсивность, разгрузка — и вес снаряда в каждой неделе.</p>
					</div>
					<div class="chip" style="flex:0 0 auto"><b>8 недель</b> · 4 плана</div>
				</div>
				<div style="display:flex;justify-content:center;margin-top:6px">
					${phone(cycle, 336, 'transform:rotate(-2.5deg)')}
					${phone(progress, 336, 'margin-left:18px;transform:translateY(46px) rotate(2.5deg)')}
				</div>
			</div>`),
		join(dirs.posts, 'post-2-cycle-1080x1350.jpg')
	);

	await composeCard(
		page,
		{ width: 1080, height: 1350 },
		post(`
			<div style="display:flex;gap:40px;align-items:center;width:100%">
				${phone(home, 404, 'flex:0 0 auto;transform:rotate(2.5deg)')}
				<div style="flex:1;display:flex;flex-direction:column;gap:26px">
					<div class="kicker"><i></i>Дневник</div>
					<h1 style="font-size:74px">Всё<br>в одном</h1>
					<p class="sub" style="font-size:29px;max-width:390px">План, подходы, вес, рекорды и история. Без заметок и таблиц.</p>
					<div class="cta">repdraft.ru <span>бесплатно</span></div>
				</div>
			</div>`),
		join(dirs.posts, 'post-3-diary-1080x1350.jpg')
	);

	await composeCard(
		page,
		{ width: 1080, height: 1350 },
		post(`
			<div style="display:flex;gap:40px;align-items:center;width:100%">
				<div style="flex:1;display:flex;flex-direction:column;gap:26px">
					<div class="kicker"><i></i>ИИ-черновик</div>
					<h1 style="font-size:76px">План<br>за минуту</h1>
					<p class="sub" style="font-size:29px;max-width:400px">Опиши зал, время и самочувствие — ИИ соберёт тренировку из каталога. Дальше правишь в редакторе.</p>
					<div style="display:flex;gap:12px;flex-wrap:wrap">
						<div class="chip"><b>4 упр.</b> за запрос</div>
						<div class="chip"><b>Свой зал</b></div>
					</div>
				</div>
				${phone(ai, 392, 'flex:0 0 auto;transform:rotate(-2deg)')}
			</div>`),
		join(dirs.posts, 'post-4-ai-draft-1080x1350.jpg')
	);

	const story = (inner) =>
		`<div class="stage" style="width:1080px;height:1920px;padding:96px 84px;flex-direction:column">${inner}<div class="grain"></div></div>`;

	await composeCard(
		page,
		{ width: 1080, height: 1920 },
		story(`
			<div style="display:flex;flex-direction:column;gap:30px;align-items:flex-start">
				<div class="kicker"><i></i>Repdraft</div>
				<h1 style="font-size:96px">Планка —<br>по времени</h1>
				<p class="sub" style="font-size:32px;max-width:640px">Секундомер пишет подход сам. Дорожка считает минуты.</p>
			</div>
			<div style="display:flex;justify-content:center;margin-top:54px">
				${phone(live, 520, 'transform:rotate(-2deg)')}
			</div>
			<div style="margin-top:auto;display:flex;justify-content:center;width:100%">
				<div class="cta" style="font-size:28px;padding:24px 42px">repdraft.ru <span>бесплатно</span></div>
			</div>`),
		join(dirs.stories, 'story-1-plank-1080x1920.jpg')
	);

	await composeCard(
		page,
		{ width: 1080, height: 1920 },
		story(`
			<div style="display:flex;flex-direction:column;gap:26px;align-items:flex-start">
				<div class="kicker"><i></i>Цикл</div>
				<h1 style="font-size:92px">10 недель<br>с планом</h1>
				<p class="sub" style="font-size:32px;max-width:660px">Каждая неделя знает свои подходы, повторы и вес.</p>
			</div>
			<div style="display:flex;justify-content:center;margin-top:40px">
				${phone(cycle, 470, 'transform:rotate(2deg)')}
			</div>
			<div style="margin-top:auto;display:flex;justify-content:center;width:100%">
				<div class="cta" style="font-size:28px;padding:24px 42px">repdraft.ru <span>бесплатно</span></div>
			</div>`),
		join(dirs.stories, 'story-2-cycle-1080x1920.jpg')
	);

	await composeCard(
		page,
		{ width: 1080, height: 1920 },
		story(`
			<div style="display:flex;flex-direction:column;gap:26px;align-items:flex-start">
				<div class="kicker"><i></i>Прогресс</div>
				<h1 style="font-size:92px">Видно,<br>что растёт</h1>
				<p class="sub" style="font-size:32px;max-width:660px">Тоннаж, объём по неделям и доли по группам мышц — за 7, 30 и 90 дней.</p>
			</div>
			<div style="display:flex;justify-content:center;margin-top:40px">
				${phone(progress, 470, 'transform:rotate(-2deg)')}
			</div>
			<div style="margin-top:auto;display:flex;justify-content:center;width:100%">
				<div class="cta" style="font-size:28px;padding:24px 42px">repdraft.ru <span>бесплатно</span></div>
			</div>`),
		join(dirs.stories, 'story-3-progress-1080x1920.jpg')
	);

	// Wide landing banners: text left, overlapping phones right.
	const wide = (inner) =>
		`<div class="stage" style="width:1600px;height:1000px;padding:0;align-items:center">${inner}<div class="grain"></div></div>`;

	await composeCard(
		page,
		{ width: 1600, height: 1000 },
		wide(`
			<div style="display:grid;grid-template-columns:1fr 760px;gap:40px;align-items:center;width:100%;padding:0 90px">
				<div style="display:flex;flex-direction:column;gap:28px">
					<div class="kicker"><i></i>Repdraft · дневник тренировок</div>
					<h1 style="font-size:84px;max-width:660px">Планка — по секундомеру,<br>дорожка — по минутам</h1>
					<p class="sub" style="font-size:29px;max-width:560px">План на неделю, подходы и вес, рекорды и история. Всё в одном приложении — на телефоне и в браузере.</p>
					<div style="display:flex;gap:14px;align-items:center">
						<div class="cta" style="font-size:26px;padding:22px 38px">Начать бесплатно</div>
						<div class="chip" style="font-size:21px">repdraft.ru</div>
					</div>
				</div>
				<div style="position:relative;height:1000px;display:flex;align-items:center;justify-content:center">
					${phone(home, 300, 'position:absolute;left:16px;top:150px;transform:rotate(-5deg)')}
					${phone(plan, 300, 'position:absolute;left:238px;top:104px;transform:rotate(1deg);z-index:2')}
					${phone(live, 300, 'position:absolute;left:456px;top:176px;transform:rotate(4.5deg)')}
				</div>
			</div>`),
		join(dirs.landing, 'hero-1600x1000.jpg')
	);

	await composeCard(
		page,
		{ width: 1600, height: 1000 },
		wide(`
			<div style="display:grid;grid-template-columns:660px 1fr;gap:50px;align-items:center;width:100%;padding:0 90px">
				<div style="display:flex;flex-direction:column;gap:26px">
					<div class="kicker"><i></i>Что нового</div>
					<h1 style="font-size:76px;max-width:580px">Время вместо повторов</h1>
					<p class="sub" style="font-size:28px;max-width:540px">Планка и изометрия считаются секундами, дорожка и велотренажёр — минутами. Секундомер закрывает подход сам.</p>
					<div style="display:flex;gap:12px;flex-wrap:wrap">
						<div class="chip"><b>30 сек</b> планка</div>
						<div class="chip"><b>20 мин</b> дорожка</div>
						<div class="chip"><b>0 тапов</b> вручную</div>
					</div>
				</div>
				<div style="display:flex;justify-content:center;align-items:center;height:1000px">
					${phone(live, 420, 'transform:rotate(-2deg)')}
				</div>
			</div>`),
		join(dirs.landing, 'feature-timing-1600x1000.jpg')
	);
}

/* ---------------------------------------------------------------------- main */

async function main() {
	const cleanDir = ensureDir('clean');
	const dirs = {
		posts: ensureDir('posts'),
		stories: ensureDir('stories'),
		landing: ensureDir('landing')
	};

	let server = null;
	if (!process.env.ADS_BASE) {
		console.log('[ads] starting app server...');
		server = startServer();
	}
	await waitForServer(BASE);

	const { chromium } = await loadPlaywright();
	const browser = await chromium.launch({ headless: true });
	try {
		const context = await browser.newContext({
			viewport: PHONE,
			deviceScaleFactor: 3,
			isMobile: true,
			hasTouch: true,
			locale: 'ru-RU',
			timezoneId: 'Europe/Moscow',
			serviceWorkers: 'block',
			colorScheme: 'dark'
		});
		await seedContext(context);
		const page = await context.newPage();

		if (ONLY === 'all' || ONLY === 'clean') {
			console.log('[ads] clean phone screens (1080×2400)');
			await captureClean(page, cleanDir);
		}

		if (ONLY === 'all' || ONLY === 'cards') {
			console.log('[ads] composed cards');
			const cardContext = await browser.newContext({
				viewport: { width: 1080, height: 1350 },
				deviceScaleFactor: 1,
				locale: 'ru-RU'
			});
			const cardPage = await cardContext.newPage();
			await captureCards(cardPage, cleanDir, dirs);
			await cardContext.close();
		}
	} finally {
		await browser.close();
		if (server) server.kill('SIGTERM');
	}

	writeFileSync(
		join(OUT, 'README.md'),
		`# Реклама · ${STAMP}\n\n` +
			`Сгенерировано \`npm run ads\` (RU, тёмная тема, локальные демо-данные — без реальных аккаунтов).\n\n` +
			`## Что внутри\n\n` +
			`| Папка | Размер | Для чего |\n|---|---|---|\n` +
			`| \`clean/\` | 1080×2400 PNG | экраны без обвеса: рамки, подписи и кропы накладываются в редакторе |\n` +
			`| \`posts/\` | 1080×1350 JPEG | лента Telegram / VK, 4:5 |\n` +
			`| \`stories/\` | 1080×1920 JPEG | сторис, Reels, шортсы, 9:16 |\n` +
			`| \`landing/\` | 1600×1000 JPEG | широкие блоки сайта и рекламные баннеры |\n\n` +
			`## Экраны (clean)\n\n` +
			`1. Главная: следующий план, прогресс за 30 дней, последние тренировки\n` +
			`2. План «Кор + дорожка»: планка 3×45 сек, дорожка 1×20 мин\n` +
			`3. Билдер: чипы «сек»/«мин» у упражнений\n` +
			`4. Волновой цикл: 8 недель, волны объёма и интенсивности\n` +
			`5. Прогресс: тоннаж, объём по неделям, доли по группам\n` +
			`6. ИИ-черновик: запрос и готовый план\n` +
			`7-8. Каталог и карточка «Бег на беговой дорожке»\n` +
			`9. История тренировки, 10. Список тренировок\n` +
			`11. Live: планка с идущим секундомером, 12. Итоги сессии\n\n` +
			`## Тексты к постам\n\n` +
			`**post-1 · Планка по секундомеру**\n\n` +
			`> Планка больше не «сколько получится». Жмёшь старт — секундомер сам закрывает подход.\n` +
			`> Дорожка считается минутами, жим — повторами. Приложение знает, что ты делаешь.\n\n` +
			`**post-2 · Нагрузка волнами**\n\n` +
			`> Цикл на 8-10 недель: неделя интенсивности, неделя объёма, разгрузка.\n` +
			`> Вес снаряда и число подходов меняются по волне, а не «как пойдёт».\n\n` +
			`**post-3 · Всё в одном**\n\n` +
			`> План на неделю, подходы и вес, рекорды, история и прогресс — в одном дневнике.\n` +
			`> Без заметок в телефоне и таблиц в Excel. Бесплатно, работает в браузере и на телефоне.\n\n` +
			`**post-4 · План за минуту**\n\n` +
			`> «Грудь и спина, 45 минут, штанга и блок» — и черновик плана готов.\n` +
			`> Дальше правишь в редакторе: подходы, повторы, отдых.\n\n` +
			`Хештеги: #тренировки #дневниктренировок #планка #прогресс #фитнес\n\n` +
			`## Переснять\n\n` +
			`\`\`\`bash\nnpm run ads              # сборка + сервер + все кадры\n` +
			`ADS_ONLY=clean npm run ads\nADS_ONLY=cards npm run ads\n` +
			`ADS_SKIP_BUILD=1 npm run ads   # если build/ уже свежий\n\`\`\`\n\n` +
			`Экраны снимаются с демо-плана в \`scripts/capture-ads.mjs\`; правь фикстуры и подписи там же.\n` +
			`Папка \`marketing/ads/\` в git не попадает — это генерируемый артефакт.\n`
	);
	console.log('[ads] done →', OUT);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
