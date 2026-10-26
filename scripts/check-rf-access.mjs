#!/usr/bin/env node
/**
 * Проверка доступности сайта из текущей сети (РФ без VPN).
 *
 * Зачем: в российских сетях обрываются ответы крупнее ~16 КБ — соединение и
 * TLS проходят, а тело доезжает не всегда. Ограничение привязано к домену
 * (SNI), а не к хостингу: Cloudflare перед Vercel уже стоит, но крупные
 * ассеты всё равно режутся, при этом cloudflare.com с тех же IP отдаёт MB.
 * Браузер в такой ситуации показывает каркас страницы без интерактива.
 *
 * Обрыв плавающий, поэтому каждая проверка повторяется несколько раз
 * и результат показывается долей успешных попыток.
 *
 *   node scripts/check-rf-access.mjs                 # прод
 *   node scripts/check-rf-access.mjs https://host    # другой хост
 *   node scripts/check-rf-access.mjs --json          # машинный вывод
 *
 * Код возврата 1, если главная страница, JS-бандл или 32 КБ не пришли
 * ни разу либо пришли нестабильно.
 */
const DEFAULT_TARGET = 'https://www.repdraft.xyz';
const CONTROL_TARGET = 'https://github.com/';
const TIMEOUT_MS = 12_000;
const ATTEMPTS = 3;

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const target = args.find((arg) => !arg.startsWith('--')) ?? DEFAULT_TARGET;

/** @param {string} url @param {RequestInit} init */
async function once(url, init = {}) {
	const started = performance.now();
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
	try {
		const response = await fetch(url, { redirect: 'follow', signal: controller.signal, ...init });
		const body = await response.arrayBuffer();
		return {
			ok: true,
			status: response.status,
			bytes: body.byteLength,
			ms: Math.round(performance.now() - started),
			server: response.headers.get('server') ?? ''
		};
	} catch (error) {
		return {
			ok: false,
			status: 0,
			bytes: 0,
			ms: Math.round(performance.now() - started),
			server: '',
			error: error instanceof Error ? error.name : 'unknown'
		};
	} finally {
		clearTimeout(timer);
	}
}

/** @param {string} url */
async function readText(url) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
	try {
		const response = await fetch(url, {
			redirect: 'follow',
			signal: controller.signal,
			headers: { 'Accept-Encoding': 'gzip' }
		});
		if (!response.ok) return '';
		return await response.text();
	} catch {
		return '';
	} finally {
		clearTimeout(timer);
	}
}

/**
 * @param {string} url
 * @param {{ method?: string, headers?: Record<string, string> }} init
 * @param {(result: { ok: boolean, status: number, bytes: number }) => boolean} isGood
 */
async function repeat(url, init, isGood) {
	if (!url) return { passed: 0, attempts: 0, bytes: 0, ms: 0, stable: false, dead: true };
	const runs = [];
	for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
		runs.push(await once(url, init));
	}
	const passed = runs.filter((run) => run.ok && run.status < 400 && isGood(run)).length;
	const bytes = Math.max(...runs.map((run) => run.bytes));
	const ms = Math.round(runs.reduce((sum, run) => sum + run.ms, 0) / runs.length);
	const server = runs.find((run) => run.server)?.server ?? '';
	return { passed, attempts: ATTEMPTS, bytes, ms, server, stable: passed === ATTEMPTS, dead: passed === 0 };
}

const anyBody = () => true;
const browserHeaders = { 'Accept-Encoding': 'gzip, br' };

// Браузер грузит HTML, потом JS-бандл. Берём реальные ссылки из разметки,
// чтобы проверять не абстрактные 32 КБ, а то, без чего страница не оживёт.
const html = await readText(`${target}/`);
const assets = [...html.matchAll(/\/_app\/immutable\/[^"']+\.js/g)].map((match) => match[0]);
const entryAsset = assets.find((path) => path.includes('/entry/')) ?? assets[0] ?? '';
const chunkAsset = assets.find((path) => path.includes('/chunks/')) ?? assets[1] ?? '';

const checks = [
	{
		label: 'HEAD / (только заголовки)',
		run: () => repeat(`${target}/`, { method: 'HEAD' }, anyBody)
	},
	{
		label: 'GET /robots.txt',
		run: () => repeat(`${target}/robots.txt`, {}, anyBody)
	},
	{
		label: 'GET / range 8 КБ',
		run: () => repeat(`${target}/`, { headers: { Range: 'bytes=0-8191' } }, (r) => r.bytes >= 8192)
	},
	{
		label: 'GET / range 32 КБ',
		run: () => repeat(`${target}/`, { headers: { Range: 'bytes=0-32767' } }, (r) => r.bytes >= 32768)
	},
	{
		label: 'GET / главная целиком',
		run: () => repeat(`${target}/`, {}, anyBody)
	},
	{
		label: 'GET / как браузер (gzip)',
		run: () => repeat(`${target}/`, { headers: browserHeaders }, anyBody)
	},
	{
		label: 'GET JS entry (gzip)',
		run: () => repeat(entryAsset ? `${target}${entryAsset}` : '', { headers: browserHeaders }, anyBody)
	},
	{
		label: 'GET JS chunk (gzip)',
		run: () => repeat(chunkAsset ? `${target}${chunkAsset}` : '', { headers: browserHeaders }, anyBody)
	},
	{
		label: 'GET /og-image.jpg',
		run: () => repeat(`${target}/og-image.jpg`, {}, anyBody)
	}
];

const results = [];
for (const check of checks) {
	results.push({ label: check.label, ...(await check.run()) });
}

const control = await repeat(CONTROL_TARGET, {}, anyBody);

const page = results.find((r) => r.label.includes('главная'));
const entry = results.find((r) => r.label.includes('JS entry'));
const bigRange = results.find((r) => r.label.includes('32 КБ'));
const smallOk = results.slice(0, 3).every((r) => r.passed > 0);
const healthy = Boolean(page?.stable && bigRange?.stable && entry?.stable);
const behindCloudflare = results.some((r) => /cloudflare/i.test(r.server));

if (asJson) {
	console.log(
		JSON.stringify({ target, healthy, behindCloudflare, control, results }, null, 2)
	);
	process.exit(healthy ? 0 : 1);
}

function fmt(result) {
	if (result.attempts === 0) return '— (не нашлось в разметке)';
	if (result.dead) return `✗ 0/${result.attempts} · обрыв через ${result.ms} мс`;
	const mark = result.stable ? '✓' : '⚠';
	return `${mark} ${result.passed}/${result.attempts} · ${result.bytes} Б · ~${result.ms} мс`;
}

console.log(`\nДоступность ${target} из этой сети\n`);
for (const result of results) {
	console.log(`  ${result.label.padEnd(30)} ${fmt(result)}`);
}
console.log(
	`\n  ${'контроль: github.com'.padEnd(30)} ${
		control.passed > 0 ? `✓ ${control.passed}/${control.attempts} · ${control.bytes} Б` : '✗ недоступен'
	}\n`
);

if (healthy) {
	console.log('Итог: большие ответы и JS приходят стабильно — доступ из этой сети в порядке.\n');
	process.exit(0);
}

if (control.passed === 0) {
	console.log('Итог: не открывается даже контрольный сайт — проблема в сети, а не в приложении.\n');
	process.exit(1);
}

if (smallOk && (page?.dead || entry?.dead || bigRange?.dead || page?.passed < page?.attempts)) {
	const parts = [
		'Итог: маленькие ответы проходят, крупные — обрываются или приходят не всегда.',
		'Ограничение привязано к домену (SNI) и размеру ответа, а не к хостингу.'
	];
	if (behindCloudflare) {
		parts.push(
			'Сайт уже за Cloudflare: прокси перед Vercel сам по себе не помогает.',
			'Нужен российский хостинг/CDN или обход DPI.'
		);
	} else {
		parts.push('Прокси перед Vercel (Cloudflare) или хостинг вне Vercel не решат проблему полностью.');
	}
	if (entry && entry.dead) {
		parts.push('Браузер получит HTML, но не загрузит JS — страница останется без интерактива.');
	}
	console.log(`${parts.join('\n')}\n`);
	process.exit(1);
}

console.log('Итог: сайт недоступен целиком — смотри DNS и статус деплоя.\n');
process.exit(1);
