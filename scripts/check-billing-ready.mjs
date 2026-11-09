#!/usr/bin/env node
/**
 * Ops probe: which Pro billing env keys are present (names only).
 * Does not print secret values. Exit 0 when default provider can checkout.
 */
import fs from 'node:fs';
import path from 'node:path';

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
		if (
			(v.startsWith('"') && v.endsWith('"')) ||
			(v.startsWith("'") && v.endsWith("'"))
		) {
			v = v.slice(1, -1);
		}
		out[k] = v;
	}
	return out;
}

const env = loadEnv(envPath);
const keys = [
	'BILLING_DEFAULT_PROVIDER',
	'YOOKASSA_SHOP_ID',
	'YOOKASSA_SECRET_KEY',
	'YOOKASSA_AMOUNT_MONTHLY',
	'YOOKASSA_AMOUNT_YEARLY',
	'YOOKASSA_CURRENCY',
	'STRIPE_SECRET_KEY',
	'STRIPE_WEBHOOK_SECRET',
	'STRIPE_PRICE_MONTHLY',
	'STRIPE_PRICE_YEARLY',
	'SUPABASE_SERVICE_ROLE_KEY',
	'AI_VISION_MODEL'
];

console.log('Repdraft Pro billing readiness (.env names only)\n');
for (const k of keys) {
	const v = (env[k] ?? '').trim();
	const state = !(k in env) ? 'MISSING' : v ? `SET (len=${v.length})` : 'EMPTY';
	console.log(`  ${k}: ${state}`);
}

const yookassa = Boolean(env.YOOKASSA_SHOP_ID?.trim() && env.YOOKASSA_SECRET_KEY?.trim());
const stripe = Boolean(
	env.STRIPE_SECRET_KEY?.trim() &&
		env.STRIPE_PRICE_MONTHLY?.trim() &&
		env.STRIPE_PRICE_YEARLY?.trim()
);
const def = (env.BILLING_DEFAULT_PROVIDER || 'yookassa').trim().toLowerCase();
const ready =
	(def === 'stripe' && stripe) || (def !== 'stripe' && yookassa) || yookassa || stripe;

console.log('\n  yookassa checkout:', yookassa ? 'ready' : 'not configured');
console.log('  stripe checkout:', stripe ? 'ready' : 'not configured');
console.log('  default provider:', def);
console.log('  overall:', ready ? 'OK' : 'BLOCKED - set YOOKASSA_* or STRIPE_*');
console.log('\nProduction also needs the same keys in Vercel env + webhook URL:');
console.log('  https://www.repdraft.xyz/api/billing/webhook/yookassa');
console.log('SQL (already local): ~/.repdraft-sql/billing-entitlements.sql');

process.exit(ready ? 0 : 1);
