#!/usr/bin/env node
/**
 * Ops probe for the feedback form mail path (names only, never secrets).
 *
 *   npm run check:feedback          -> env presence overview
 *   npm run check:feedback -- --send -> SMTP verify + one test letter to FEEDBACK_EMAIL_TO
 *
 * `--send` needs an app password (Yandex 360), not the mailbox password.
 */
import fs from 'node:fs';
import path from 'node:path';
import nodemailer from 'nodemailer';

const root = path.resolve(import.meta.dirname, '..');
const envPath = path.join(root, '.env');

function loadEnv(file) {
	if (!fs.existsSync(file)) return {};
	const out = {};
	for (const line of fs.readFileSync(file, 'utf8').split(/\n/)) {
		if (!line || line.trim().startsWith('#')) continue;
		const i = line.indexOf('=');
		if (i < 0) continue;
		const k = line.slice(0, i).trim();
		let v = line.slice(i + 1).trim();
		if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
			v = v.slice(1, -1);
		}
		out[k] = v;
	}
	return out;
}

const env = { ...loadEnv(envPath), ...process.env };
const get = (key) => String(env[key] ?? '').trim();

const user = get('FEEDBACK_SMTP_USER');
const pass = get('FEEDBACK_SMTP_PASS');
const host = get('FEEDBACK_SMTP_HOST') || 'smtp.yandex.ru';
const port = Number(get('FEEDBACK_SMTP_PORT') || '465');
const secureRaw = get('FEEDBACK_SMTP_SECURE');
const secure = secureRaw ? secureRaw === 'true' || secureRaw === '1' : port === 465;
const to = get('FEEDBACK_EMAIL_TO') || get('PUBLIC_PRIVACY_CONTACT_EMAIL');
const from = get('FEEDBACK_EMAIL_FROM') || user;

console.log('Repdraft feedback mail readiness (.env names only)\n');
for (const key of [
	'FEEDBACK_SMTP_HOST',
	'FEEDBACK_SMTP_PORT',
	'FEEDBACK_SMTP_SECURE',
	'FEEDBACK_SMTP_USER',
	'FEEDBACK_SMTP_PASS',
	'FEEDBACK_EMAIL_TO',
	'FEEDBACK_EMAIL_FROM'
]) {
	const v = get(key);
	const state = !(key in env) ? 'MISSING' : v ? `SET (len=${v.length})` : 'EMPTY';
	console.log(`  ${key}: ${state}`);
}
console.log(`\n  resolved: ${host}:${port} secure=${secure}`);
console.log(`  from: ${from || '(empty)'}`);
console.log(`  to: ${to || '(empty)'}`);

if (!user || !pass || !from || !to) {
	console.log('\nNot ready: set FEEDBACK_SMTP_USER and FEEDBACK_SMTP_PASS.');
	console.log('FEEDBACK_EMAIL_TO falls back to PUBLIC_PRIVACY_CONTACT_EMAIL; FEEDBACK_EMAIL_FROM to the SMTP user.');
	console.log('Form shows "temporarily unavailable" and the fallback address until then.');
	process.exit(1);
}

console.log('\nConfig looks complete. The form will send through this SMTP account.');

if (!process.argv.includes('--send')) {
	console.log('Run with `-- --send` to verify the login and send one test letter.');
	process.exit(0);
}

const transport = nodemailer.createTransport({
	host,
	port,
	secure,
	auth: { user, pass },
	connectionTimeout: 10_000,
	greetingTimeout: 10_000,
	socketTimeout: 20_000
});

try {
	await transport.verify();
	console.log('\nSMTP login OK.');
	const info = await transport.sendMail({
		from: { name: 'Repdraft', address: from },
		to,
		subject: '[Repdraft] Проверка формы обратной связи',
		text: `Это тестовое письмо из npm run check:feedback.\n\nЕсли оно пришло, форма /feedback настроена.\nSMTP: ${host}:${port}`
	});
	console.log(`Test letter sent: ${info.messageId ?? '(no id)'}`);
} catch (err) {
	console.error('\nSMTP check failed:', err instanceof Error ? err.message : err);
	process.exit(1);
} finally {
	transport.close();
}
