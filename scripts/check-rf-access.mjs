#!/usr/bin/env node
/**
 * Проверка доступности сайта из текущей сети (РФ без VPN).
 *
 * Зачем: российские сети режут трафик к edge-сетям Vercel — TCP и TLS
 * проходят, а тело ответа больше ~16 КБ доезжает через раз. Снаружи
 * (VPN, зарубежный сервис) сайт при этом полностью жив. Браузер в такой
 * ситуации показывает белый экран без ошибки.
 *
 * Обрыв плавающий, поэтому каждая проверка повторяется несколько раз
 * и результат показывается долей успешных попыток.
 *
 *   node scripts/check-rf-access.mjs                 # прод
 *   node scripts/check-rf-access.mjs https://host    # другой хост
 *   node scripts/check-rf-access.mjs --json          # машинный вывод
 *
 * Код возврата 1, если главная страница или 32 КБ не пришли ни разу
 * либо пришли нестабильно.
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
			ms: Math.round(performance.now() - started)
		};
	} catch (error) {
		return {
			ok: false,
			status: 0,
			bytes: 0,
			ms: Math.round(performance.now() - started),
			error: error instanceof Error ? error.name : 'unknown'
		};
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
	const runs = [];
	for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
		runs.push(await once(url, init));
	}
	const passed = runs.filter((run) => run.ok && run.status < 400 && isGood(run)).length;
	const bytes = Math.max(...runs.map((run) => run.bytes));
	const ms = Math.round(runs.reduce((sum, run) => sum + run.ms, 0) / runs.length);
	return { passed, attempts: ATTEMPTS, bytes, ms, stable: passed === ATTEMPTS, dead: passed === 0 };
}

const anyBody = () => true;

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
const bigRange = results.find((r) => r.label.includes('32 КБ'));
const smallOk = results.slice(0, 3).every((r) => r.passed > 0);
const healthy = Boolean(page?.stable && bigRange?.stable);

if (asJson) {
	console.log(JSON.stringify({ target, healthy, control, results }, null, 2));
	process.exit(healthy ? 0 : 1);
}

function fmt(result) {
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
	console.log('Итог: большие ответы приходят стабильно — доступ из этой сети в порядке.\n');
	process.exit(0);
}

if (control.passed === 0) {
	console.log('Итог: не открывается даже контрольный сайт — проблема в сети, а не в приложении.\n');
	process.exit(1);
}

if (smallOk && (page?.dead || bigRange?.dead || page?.passed < page?.attempts)) {
	console.log(
		'Итог: маленькие ответы проходят, большие — обрываются или приходят не всегда.\n' +
			'Это блокировка edge-сети Vercel из РФ. Нужен прокси перед Vercel (Cloudflare)\n' +
			'или хостинг вне Vercel.\n'
	);
	process.exit(1);
}

console.log('Итог: сайт недоступен целиком — смотри DNS и статус деплоя.\n');
process.exit(1);
