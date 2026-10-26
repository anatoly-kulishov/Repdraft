#!/usr/bin/env node
/**
 * Переводит repdraft.xyz на Cloudflare в режиме прокси, оставляя Vercel оригиналом.
 *
 * Зачем: из РФ edge-сети Vercel обрывают ответы больше ~16 КБ, поэтому сайт
 * показывает белый экран. Cloudflare из РФ доступен и отдаёт мегабайты.
 * Схема: клиент → Cloudflare (прокси) → Vercel (оригинал). Домен не меняется.
 *
 * Предусловия:
 *   1. Токен Vercel: vercel.com/account/tokens → ~/.vercel-token (chmod 600)
 *      или VERCEL_TOKEN.
 *   2. Аккаунт Cloudflare, сайт repdraft.xyz добавлен (Free).
 *      Токен: Zone:Read + Zone:Edit + DNS:Edit + Zone Settings:Edit →
 *      ~/.cloudflare-token (chmod 600) или CLOUDFLARE_API_TOKEN.
 *
 *   node scripts/rf-proxy-setup.mjs                    # план
 *   node scripts/rf-proxy-setup.mjs --apply            # DNS + настройки + NS
 *   node scripts/rf-proxy-setup.mjs --apply --skip-ns  # только Cloudflare
 *   node scripts/rf-proxy-setup.mjs --apply --ns-only  # только переключить NS
 *
 * Идемпотентно: повторный запуск не ломает уже настроенное.
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const DOMAIN = 'repdraft.xyz';
const ORIGIN = 'cname.vercel-dns.com';
const TXT_RECORDS = ['google-site-verification=5bXGtK0AixSZr1PLvIAYQuZdZpBb4FD-v2aJi6V-byc'];
const CAA = [
	{ flags: 0, tag: 'issue', value: 'letsencrypt.org' },
	{ flags: 0, tag: 'issue', value: 'pki.goog' },
	{ flags: 0, tag: 'issue', value: 'sectigo.com' }
];

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const skipNs = args.includes('--skip-ns');
const nsOnly = args.includes('--ns-only');

function readToken(envName, fileCandidates) {
	const fromEnv = process.env[envName]?.trim();
	if (fromEnv) return { token: fromEnv, source: `env ${envName}` };
	for (const candidate of fileCandidates) {
		try {
			const raw = readFileSync(candidate, 'utf8').trim();
			if (!raw) continue;
			if (raw.startsWith('{')) {
				const parsed = JSON.parse(raw);
				if (parsed.token) return { token: parsed.token, source: candidate };
				continue;
			}
			return { token: raw, source: candidate };
		} catch {
			// файла нет — идём дальше
		}
	}
	return null;
}

const cloudflare = readToken('CLOUDFLARE_API_TOKEN', [
	path.join(homedir(), '.cloudflare-token'),
	path.join(homedir(), '.config', 'cloudflare-token')
]);
const vercel = readToken('VERCEL_TOKEN', [
	path.join(homedir(), '.vercel-token'),
	path.join(homedir(), '.config', 'vercel-token'),
	path.join(homedir(), 'Library', 'Application Support', 'com.vercel.cli', 'auth.json'),
	path.join(homedir(), '.local', 'share', 'com.vercel.cli', 'auth.json')
]);

function fail(message) {
	console.error(`\n✗ ${message}\n`);
	process.exit(1);
}

function step(text) {
	console.log(`\n▸ ${text}`);
}

async function call(base, token, route, init = {}) {
	const response = await fetch(`${base}${route}`, {
		...init,
		signal: AbortSignal.timeout(20_000),
		headers: {
			Authorization: `Bearer ${token}`,
			...(init.body ? { 'Content-Type': 'application/json' } : {}),
			...init.headers
		}
	});
	const text = await response.text();
	let json = {};
	try {
		json = text ? JSON.parse(text) : {};
	} catch {
		json = { raw: text };
	}
	if (!response.ok) {
		const detail = JSON.stringify(json.errors ?? json.error ?? json).slice(0, 400);
		throw new Error(`${init.method ?? 'GET'} ${route} → ${response.status}: ${detail}`);
	}
	return json;
}

const CF = 'https://api.cloudflare.com/client/v4';
const VERCEL = 'https://api.vercel.com';

async function cloudflarePart() {
	if (!cloudflare) {
		fail(
			'Нет токена Cloudflare.\n' +
				'  vercel? нет — нужен Cloudflare: My Profile → API Tokens → Create Custom Token\n' +
				'  (Zone:Read, Zone:Edit, DNS:Edit, Zone Settings:Edit), затем:\n' +
				'  echo "ТОКЕН" > ~/.cloudflare-token && chmod 600 ~/.cloudflare-token'
		);
	}
	const cf = (route, init) => call(CF, cloudflare.token, route, init);

	step('Проверяю токен Cloudflare');
	const verify = await cf('/user/tokens/verify');
	console.log(`  статус: ${verify.result?.status ?? 'ok'} (${cloudflare.source})`);

	step(`Ищу зону ${DOMAIN}`);
	const zones = await cf(`/zones?name=${DOMAIN}`);
	const zone = zones.result?.[0];
	if (!zone) {
		fail(
			`Зоны ${DOMAIN} нет в Cloudflare.\n` +
				'  Добавь сайт: dash.cloudflare.com → Add a site/domain → Free, потом повтори.'
		);
	}
	const zoneId = zone.id;
	const ns = zone.name_servers ?? [];
	console.log(`  zone id: ${zoneId}`);
	console.log(`  nameservers: ${ns.join(', ') || '(не выданы)'}`);
	if (ns.length < 2) fail('Cloudflare не выдал nameservers — заверши добавление сайта.');

	step('Текущие записи в Cloudflare');
	const existing = await cf(`/zones/${zoneId}/dns_records?per_page=100`);
	for (const record of existing.result ?? []) {
		console.log(
			`  ${record.type.padEnd(6)} ${record.name.padEnd(28)} ${String(record.content).slice(0, 46)}` +
				`${record.proxied ? ' [proxied]' : ''}`
		);
	}

	const plan = [];
	for (const record of existing.result ?? []) {
		const apexAddress = (record.type === 'A' || record.type === 'AAAA') && record.name === DOMAIN;
		const wwwAddress =
			(record.type === 'A' || record.type === 'AAAA') && record.name === `www.${DOMAIN}`;
		// A/AAAA на apex и www конфликтуют с CNAME — убираем, ставим проксируемый CNAME.
		if (apexAddress || wwwAddress) plan.push({ action: 'delete', record });
	}

	const desired = [
		{ type: 'CNAME', name: DOMAIN, content: ORIGIN, proxied: true, ttl: 1 },
		{ type: 'CNAME', name: `www.${DOMAIN}`, content: ORIGIN, proxied: true, ttl: 1 },
		...TXT_RECORDS.map((value) => ({
			type: 'TXT',
			name: DOMAIN,
			content: value,
			proxied: false,
			ttl: 1
		})),
		...CAA.map((entry) => ({
			type: 'CAA',
			name: DOMAIN,
			proxied: false,
			ttl: 1,
			data: entry,
			content: `${entry.flags} ${entry.tag} "${entry.value}"`
		}))
	];

	for (const want of desired) {
		// Cloudflare отдаёт TXT в кавычках — сравниваем без них.
		const normalize = (value) => String(value ?? '').replace(/^"|"$/g, '');
		const same = (existing.result ?? []).find(
			(record) =>
				record.type === want.type &&
				record.name === want.name &&
				normalize(record.content) === normalize(want.content)
		);
		if (!same) plan.push({ action: 'create', record: want });
		else if (want.type === 'CNAME' && same.proxied !== true) plan.push({ action: 'proxy-on', record: same });
	}

	step('План изменений DNS');
	if (plan.length === 0) console.log('  записей менять не нужно');
	for (const item of plan) {
		if (item.action === 'delete') {
			console.log(`  − удалить ${item.record.type} ${item.record.name} → ${item.record.content}`);
		} else if (item.action === 'create') {
			const value = item.record.content ?? JSON.stringify(item.record.data);
			console.log(`  + создать ${item.record.type} ${item.record.name} → ${value}${item.record.proxied ? ' [proxied]' : ''}`);
		} else {
			console.log(`  ~ включить прокси для ${item.record.type} ${item.record.name}`);
		}
	}

	const settings = [
		{ key: 'ssl', value: 'strict', label: 'SSL: Full (strict)' },
		{ key: 'always_use_https', value: 'on', label: 'Always Use HTTPS: on' },
		{ key: 'rocket_loader', value: 'off', label: 'Rocket Loader: off' },
		{ key: 'minify', value: { js: 'off', css: 'off', html: 'off' }, label: 'Auto Minify: off' }
	];

	step('План настроек зоны');
	for (const setting of settings) console.log(`  ~ ${setting.label}`);

	if (!apply) return { zoneId, ns, pending: true };

	step('Применяю изменения DNS');
	for (const item of plan) {
		if (item.action === 'delete') {
			await cf(`/zones/${zoneId}/dns_records/${item.record.id}`, { method: 'DELETE' });
			console.log(`  − ${item.record.type} ${item.record.name}`);
		} else if (item.action === 'create') {
			const body = {
				type: item.record.type,
				name: item.record.name,
				ttl: item.record.ttl ?? 1,
				proxied: Boolean(item.record.proxied)
			};
			if (item.record.type === 'CAA') body.data = item.record.data;
			else body.content = item.record.content;
			await cf(`/zones/${zoneId}/dns_records`, { method: 'POST', body: JSON.stringify(body) });
			console.log(`  + ${item.record.type} ${item.record.name}`);
		} else {
			await cf(`/zones/${zoneId}/dns_records/${item.record.id}`, {
				method: 'PATCH',
				body: JSON.stringify({ proxied: true })
			});
			console.log(`  ~ proxy on ${item.record.name}`);
		}
	}

	step('Применяю настройки зоны');
	for (const setting of settings) {
		try {
			await cf(`/zones/${zoneId}/settings/${setting.key}`, {
				method: 'PATCH',
				body: JSON.stringify({ value: setting.value })
			});
			console.log(`  ~ ${setting.label}`);
		} catch (error) {
			console.log(`  ! ${setting.label}: ${error.message}`);
		}
	}

	step('Отключаю Bot Fight Mode');
	try {
		await cf(`/zones/${zoneId}/bot_management`, {
			method: 'PUT',
			body: JSON.stringify({ fight_mode: false })
		});
		console.log('  ~ fight_mode: false');
	} catch (error) {
		console.log(`  ! не получилось (не критично): ${error.message}`);
	}

	return { zoneId, ns, pending: false };
}

async function vercelPart(ns) {
	if (!vercel) {
		fail(
			'Нет токена Vercel.\n' +
				'  vercel.com/account/tokens → Create Token, затем:\n' +
				'  echo "ТОКЕН" > ~/.vercel-token && chmod 600 ~/.vercel-token'
		);
	}
	const vc = (route, init) => call(VERCEL, vercel.token, route, init);

	step('Проверяю токен Vercel');
	const me = await vc('/v2/user');
	console.log(`  аккаунт: ${me.user?.username ?? me.user?.email ?? 'ok'}`);

	const before = await vc(`/v4/domains/${DOMAIN}`);
	const current = before.nameservers ?? [];
	console.log(`  nameservers сейчас: ${current.join(', ') || '(Vercel по умолчанию)'}`);

	if (current.length === ns.length && current.every((item) => ns.includes(item))) {
		console.log('  уже переключены на Cloudflare — менять не нужно');
		return;
	}
	if (!apply) {
		console.log(`  ~ переключить на: ${ns.join(', ')}`);
		return;
	}

	step('Переключаю nameservers в Vercel');
	await vc(`/v1/registrar/domains/${DOMAIN}/nameservers`, {
		method: 'PATCH',
		body: JSON.stringify({ nameservers: ns })
	});
	console.log(`  стало: ${ns.join(', ')}`);
}

async function main() {
	console.log(`\nCloudflare → Vercel для ${DOMAIN}`);
	console.log(`Режим: ${apply ? 'ПРИМЕНЕНИЕ' : 'план'}`);
	if (skipNs) console.log('Vercel (NS) пропускаем: --skip-ns');
	if (nsOnly) console.log('Только переключение NS: --ns-only');

	let ns = [];

	if (!nsOnly) {
		const cloudflareResult = await cloudflarePart();
		if (cloudflareResult) ns = cloudflareResult.ns;
		if (!apply) {
			console.log('\nЭто был план. Запусти с --apply, чтобы применить.\n');
			return;
		}
	}

	if (skipNs) {
		console.log('\n✓ Cloudflare настроен. NS не трогал (--skip-ns).');
		console.log('  Переключить позже: npm run rf:proxy -- --apply --ns-only\n');
		return;
	}

	if (nsOnly && ns.length === 0) {
		// В режиме --ns-only NS берём из зоны Cloudflare.
		if (!cloudflare) fail('Для --ns-only нужен токен Cloudflare (оттуда берём nameservers).');
		const zones = await call(CF, cloudflare.token, `/zones?name=${DOMAIN}`);
		ns = zones.result?.[0]?.name_servers ?? [];
		if (ns.length < 2) fail('Cloudflare не выдал nameservers.');
	}

	await vercelPart(ns);

	console.log('\n✓ Готово. Дальше:');
	console.log(`  1. dig +short NS ${DOMAIN} @1.1.1.1   — ждать появления Cloudflare`);
	console.log('  2. npm run check:rf                    — должно стать ✓ 3/3');
	console.log('  3. Если Vercel покажет «Invalid Configuration» — выключи прокси');
	console.log('     (серая тучка) на 10 минут, пусть выпустит сертификат, включи обратно.\n');
}

main().catch((error) => fail(error.message));
