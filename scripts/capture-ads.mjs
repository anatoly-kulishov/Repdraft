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
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STAMP = process.env.ADS_STAMP ?? '2026-11-26';
const OUT = process.env.ADS_OUT ?? join(ROOT, 'marketing/ads', STAMP);
const PORT = Number(process.env.ADS_PORT ?? 4310);
const BASE = process.env.ADS_BASE ?? `http://127.0.0.1:${PORT}`;
const ONLY = process.env.ADS_ONLY ?? 'all';

/* ------------------------------------------------------------------ fixtures */

// Moscow is UTC+3 throughout the date range of these fixtures.
const DEMO_TIME = new Date(`${STAMP}T13:00:00+03:00`);
if (!/^\d{4}-\d{2}-\d{2}$/.test(STAMP) || Number.isNaN(DEMO_TIME.getTime()) || DEMO_TIME.toISOString().slice(0, 10) !== STAMP) {
	throw new Error('ADS_STAMP must be a calendar date (YYYY-MM-DD)');
}

function dayIso(daysAgo, hour = 19, minute = 10) {
	const d = new Date(DEMO_TIME);
	d.setUTCDate(d.getUTCDate() - daysAgo);
	d.setUTCHours(hour - 3, minute, 0, 0);
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

function session(id, planId, planName, daysAgo, exercises, durationMin = 65) {
	return {
		id,
		planId,
		planName,
		startedAt: dayIso(daysAgo, 19, 0),
		finishedAt: dayIso(daysAgo, 19, durationMin),
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
	], 32),
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
	const d = new Date(DEMO_TIME);
	d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) - 14);
	return d.toISOString().slice(0, 10);
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
	'repdraft:progress-period': 30,
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

async function waitForServer(url, server, timeoutMs = 240_000) {
	const started = Date.now();
	while (Date.now() - started < timeoutMs) {
		if (server?.exitCode != null) throw new Error(`App server exited with code ${server.exitCode}`);
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
				localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
			}
			localStorage.setItem('repdraft:home-next-plan-id', 'plan-push');
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
	await page.waitForFunction(() => !document.documentElement.hasAttribute('data-boot-pending'), null, {
		timeout: 20_000
	});
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
	const response = await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
	if (!response?.ok()) throw new Error(`Failed to load ${path} (${response?.status()})`);
	await settle(page);
}

function ensureDir(...parts) {
	const dir = join(OUT, ...parts);
	mkdirSync(dir, { recursive: true });
	return dir;
}

async function shot(page, file, opts = {}) {
	await page.evaluate(() => document.fonts.ready);
	const buf = await page.screenshot({ type: 'png', animations: 'disabled', caret: 'hide', ...opts });
	writeFileSync(file, buf);
	console.log('  ->', relative(ROOT, file), `${Math.round(buf.length / 1024)} KB`);
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
	await brief.fill('Грудь и спина, штанга и блок');
	await page.getByRole('button', { name: 'Сгенерировать' }).click();
	await page.getByRole('heading', { name: AI_PLAN.plan.name, exact: true }).waitFor();
	await shot(page, join(phoneDir, '06-ai-plan.png'));

	// Only the displayed time advances. The real stopwatch owns both the value and its UI.
	await goto(page, '/live/plan-cardio');
	await page.locator('.live-set-timer').first().click();
	await page.clock.setFixedTime(new Date(DEMO_TIME.getTime() + 32_000));
	await page.locator('.live-set-timer__time', { hasText: '00:32' }).waitFor();
	await shot(page, join(phoneDir, '11-live-plank.png'));

	await page.clock.setFixedTime(DEMO_TIME);
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
		name: 'Грудь и спина',
		exercises: [
			{ exerciseId: '0025', sets: 4, reps: 8, restSec: 120 },
			{ exerciseId: '3017', sets: 4, reps: 8, restSec: 120 },
			{ exerciseId: '0151', sets: 3, reps: 10, restSec: 90 },
			{ exerciseId: '0150', sets: 3, reps: 12, restSec: 60 }
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

const coreTokens = readFileSync(join(ROOT, 'src/lib/styles/blocks/tokens.core.generated.css'), 'utf8');

function dataUri(file, mime) {
	return `data:${mime};base64,${readFileSync(file).toString('base64')}`;
}

const logo = dataUri(join(ROOT, 'static/icon-192-v3.png'), 'image/png');

// Use the same Inter files as the app, including Cyrillic, inside the offline template.
const fontCss = ['latin', 'cyrillic'].map((subset) => {
	const font = dataUri(join(ROOT, `node_modules/@fontsource-variable/inter/files/inter-${subset}-wght-normal.woff2`), 'font/woff2');
	return `@font-face{font-family:Inter;src:url('${font}');font-weight:100 900;${subset === 'cyrillic' ? 'unicode-range:U+0400-045F,U+0490-0491,U+2116;' : ''}}`;
}).join('\n');

const CARD_CSS = `
	${coreTokens}
	${fontCss}
	*{box-sizing:border-box;margin:0}
	body{font-family:Inter,sans-serif;background:var(--color-bg);color:var(--color-ink)}
	.stage{width:100vw;height:100vh;display:flex;flex-direction:column;padding:64px 72px 54px}
	header,footer{display:flex;align-items:center;justify-content:space-between}
	header{border-bottom:2px solid var(--color-border);padding-bottom:28px;gap:32px}
	.brand{display:flex;align-items:center;gap:16px;font-size:37px;letter-spacing:-.05em;font-weight:740}
	.brand img{width:55px;height:55px;border-radius:13px}
	.topic{color:var(--color-accent-text);font-size:29px;font-weight:580}
	main{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:space-evenly;gap:20px}
	.copy{display:grid;gap:24px}
	h1{font-weight:750;font-size:82px;line-height:1.02;letter-spacing:-.055em;text-wrap:balance}
	p{font-size:39px;line-height:1.23;letter-spacing:-.025em;color:var(--color-muted-soft);text-wrap:pretty}
	figure{display:flex;align-items:center;justify-content:center;min-height:0}
	figure img{display:block;max-width:100%;max-height:100%;width:auto;height:auto;border-radius:22px}
	footer{border-top:2px solid var(--color-border);padding-top:25px;font-size:32px;line-height:1.1;font-weight:600}
	footer span:last-child{color:var(--color-accent-text)}
	.post figure{height:600px}
	.story{padding:274px 72px}
	.story main{gap:24px}
	.story h1{font-size:88px}
	.story figure{height:720px}
	.wide{padding:64px 80px 52px}
	.wide main{display:grid;grid-template-columns:1fr 1.04fr;gap:72px;align-items:center}
	.wide h1{font-size:76px}
	.wide p{font-size:35px;line-height:1.3}
	.wide figure{height:680px}
`;

// Rectangles in the original 360×800 CSS viewport. Keep whole rows and chart legends.
const DETAILS = {
	timer:    { file: '11-live-plank.png', x: 18, y: 205, w: 324, h: 240 },
	wave:     { file: '04-cycle.png', x: 17, y: 400, w: 326, h: 185 },
	history:  { file: '01-home.png', x: 17, y: 382, w: 326, h: 237 },
	draft:    { file: '06-ai-plan.png', x: 18, y: 317, w: 324, h: 197 },
	progress: { file: '05-progress.png', x: 17, y: 194, w: 326, h: 277 },
	plan:     { file: '02-plan-cardio.png', x: 17, y: 267, w: 326, h: 338 }
};

const POSTS = [
	{
		file: 'post-1-plank-stopwatch-1080x1350.jpg', topic: 'Тренировка', detail: 'timer',
		title: 'Планка по секундомеру',
		sub: 'Запусти таймер перед планкой. Второе нажатие сохранит время подхода.',
		caption: 'В плане три подхода по 45 секунд. Запусти секундомер, когда встанешь в планку, и останови его в конце подхода. Repdraft запишет, сколько ты продержался.'
	},
	{
		file: 'post-2-cycle-1080x1350.jpg', topic: 'Волновой цикл', detail: 'wave',
		title: 'Нагрузка по неделям',
		sub: 'Сначала неделя интенсивности, затем объём и разгрузка. На графике весь цикл.',
		caption: 'Собери цикл на 8, 10 или 12 недель из своих планов. На каждую неделю увидишь подходы и повторы. Если по упражнению есть история, появится и подсказка по весу.'
	},
	{
		file: 'post-3-diary-1080x1350.jpg', topic: 'Дневник', detail: 'history',
		title: 'Когда был день ног?',
		sub: 'Открой историю. Там дата, длительность и число подходов каждой тренировки.',
		caption: 'В списке недавних тренировок видно, когда ты в последний раз делал ноги, жим или кардио. Открой запись, чтобы посмотреть упражнения и результат каждого подхода.'
	},
	{
		file: 'post-4-ai-draft-1080x1350.jpg', topic: 'Черновик с ИИ', detail: 'draft',
		title: 'План по твоему запросу',
		sub: 'Укажи мышцы и инвентарь. ИИ подберёт упражнения из каталога для твоего черновика.',
		caption: 'Например, напиши «Грудь и спина, штанга и блок». Получишь черновик с упражнениями, подходами и отдыхом. В редакторе можно изменить упражнения, число подходов и время отдыха.'
	}
];

const STORIES = [
	{ ...POSTS[0], file: 'story-1-plank-1080x1920.jpg' },
	{
		...POSTS[1], file: 'story-2-cycle-1080x1920.jpg', title: 'Цикл на 8 недель',
		sub: 'Следи за объёмом и интенсивностью на графике. В третью неделю нагрузка снижается.'
	},
	{
		file: 'story-3-progress-1080x1920.jpg', topic: 'Прогресс', detail: 'progress',
		title: 'Сколько ты поднял?',
		sub: 'Сравни тоннаж по неделям. Рядом с каждым столбцом видно число тренировок.'
	}
];

const BANNERS = [
	{
		file: 'hero-1600x1000.jpg', topic: 'Дневник тренировок', detail: 'plan',
		title: 'Твой план на сегодня',
		sub: 'Открой тренировку и посмотри, что делать дальше. Для планки указаны секунды, для дорожки минуты.'
	},
	{
		file: 'feature-timing-1600x1000.jpg', topic: 'Секундомер', detail: 'timer',
		title: 'Время вместо повторов',
		sub: 'Запусти секундомер перед подходом. Нажми на него ещё раз, чтобы записать время и завершить подход.'
	}
];

async function captureCards(page, cleanDir, dirs) {
	const { default: sharp } = await import('sharp');
	const details = {};
	for (const [name, { file, x, y, w, h }] of Object.entries(DETAILS)) {
		const image = sharp(join(cleanDir, file));
		const { width, height } = await image.metadata();
		if (width !== PHONE.width * 3 || height !== PHONE.height * 3) throw new Error(`Unexpected size of ${file}`);
		const crop = await image.extract({ left: x * 3, top: y * 3, width: w * 3, height: h * 3 }).png().toBuffer();
		details[name] = `data:image/png;base64,${crop.toString('base64')}`;
	}

	for (const [format, size, dir, cards] of [
		['post', { width: 1080, height: 1350 }, dirs.posts, POSTS],
		['story', { width: 1080, height: 1920 }, dirs.stories, STORIES],
		['wide', { width: 1600, height: 1000 }, dirs.landing, BANNERS]
	]) {
		await page.setViewportSize(size);
		for (const card of cards) {
			await page.setContent(`<!doctype html><html lang="ru"><meta charset="utf-8"><style>${CARD_CSS}</style>
				<article class="stage ${format}">
					<header><span class="brand"><img src="${logo}" alt="">Repdraft</span><span class="topic">${card.topic}</span></header>
					<main><div class="copy"><h1>${card.title}</h1><p>${card.sub}</p></div>
						<figure><img src="${details[card.detail]}" alt=""></figure></main>
					<footer><span>Открыть дневник</span><span>repdraft.ru</span></footer>
				</article></html>`);
			await page.evaluate(() => document.fonts.ready);
			const file = join(dir, card.file);
			const buf = await page.screenshot({ type: 'jpeg', quality: 90, path: file });
			console.log('  ->', relative(ROOT, file), `${Math.round(buf.length / 1024)} KiB`);
		}
	}
}
/* ---------------------------------------------------------------------- main */

async function main() {
	if (!['all', 'clean', 'cards'].includes(ONLY)) throw new Error('ADS_ONLY must be all, clean or cards');
	const cleanDir = join(OUT, 'clean');
	const { chromium } = await loadPlaywright();
	const browser = await chromium.launch({ headless: true });
	let server;
	try {
		if (ONLY !== 'cards') {
			if (!process.env.ADS_BASE) {
				console.log('[ads] starting app server...');
				server = startServer();
			}
			await waitForServer(BASE, server);
			const context = await browser.newContext({
				viewport: PHONE,
				deviceScaleFactor: 3,
				isMobile: true,
				hasTouch: true,
				locale: 'ru-RU',
				timezoneId: 'Europe/Moscow',
				serviceWorkers: 'block',
				colorScheme: 'dark',
				reducedMotion: 'reduce'
			});
			// Exercise detail normally plays a GIF. Use its own static catalog thumbnail.
			await context.route('**/videos/*.gif', (route) => route.abort());
			await seedContext(context);
			const page = await context.newPage();
			await page.clock.setFixedTime(DEMO_TIME);
			console.log('[ads] clean phone screens (1080×2400)');
			await captureClean(page, ensureDir('clean'));
			await context.close();
		}

		if (ONLY !== 'clean') {
			console.log('[ads] composed cards');
			const page = await browser.newPage({ deviceScaleFactor: 1, locale: 'ru-RU' });
			await captureCards(page, cleanDir, {
				posts: ensureDir('posts'),
				stories: ensureDir('stories'),
				landing: ensureDir('landing')
			});
		}
	} finally {
		server?.kill('SIGTERM');
		await browser.close();
	}

	if (ONLY !== 'clean') {
		const captions = POSTS.map(({ file, title, caption }) =>
			`### ${title}\n\n[${file}](posts/${file})\n\n${caption}\n`
		).join('\n');
		writeFileSync(join(OUT, 'README.md'), `# Repdraft · ${STAMP}

Снимки веб-приложения на русском языке в тёмной теме. На экранах локальные демонстрационные данные.

| Папка | Размер | Материалы |
|---|---|---|
| clean/ | 1080×2400 PNG | 12 экранов приложения |
| posts/ | 1080×1350 JPEG | 4 поста для ленты Telegram и VK |
| stories/ | 1080×1920 JPEG | 3 сторис, поля сверху и снизу по 274 пикселя |
| landing/ | 1600×1000 JPEG | Главный баннер и блок о секундомере |

## Экраны приложения

1. Главная с планом на сегодня, прогрессом и недавними тренировками.
2. План «Кор + дорожка» с секундами и минутами.
3. Те же упражнения в редакторе плана.
4. Третья неделя восьминедельного цикла.
5. Тоннаж и распределение нагрузки за 30 дней.
6. Пример запроса и готового черновика с ИИ.
7. Каталог упражнений.
8. Техника бега на дорожке.
9. Детали завершённой тренировки ног.
10. Список планов.
11. Секундомер на 32-й секунде подхода. В плане 45 секунд.
12. Итоги тренировки «Кор + дорожка».

## Тексты к постам

${captions}
## Переснять

\`\`\`bash
npm run ads
ADS_SKIP_BUILD=1 npm run ads
ADS_ONLY=clean npm run ads
ADS_ONLY=cards npm run ads
\`\`\`

Для быстрой съёмки нужен готовый локальный build с пустыми ключами внешних сервисов.
Режим cards использует существующие PNG. Фикстуры, подписи и макеты находятся в scripts/capture-ads.mjs.
`);
	}
	console.log('[ads] done →', relative(ROOT, OUT));
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
