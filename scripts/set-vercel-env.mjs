#!/usr/bin/env node
/**
 * Sets PUBLIC_SUPABASE_* on the linked Vercel project from local .env and redeploys.
 *
 * Usage:
 *   vercel login
 *   vercel link   # select the repdraft / repdraft-zeta project
 *   node scripts/set-vercel-env.mjs
 *
 * Or with a token from https://vercel.com/account/tokens :
 *   VERCEL_TOKEN=... node scripts/set-vercel-env.mjs
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env');

function readEnvFile(file) {
	const out = {};
	for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const i = trimmed.indexOf('=');
		if (i < 0) continue;
		out[trimmed.slice(0, i)] = trimmed.slice(i + 1).trim();
	}
	return out;
}

function run(cmd, args, input) {
	return execFileSync(cmd, args, {
		cwd: root,
		input,
		encoding: 'utf8',
		stdio: ['pipe', 'pipe', 'pipe'],
		env: process.env
	});
}

if (!fs.existsSync(envPath)) {
	console.error('Missing .env — create it with PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY');
	process.exit(1);
}

const env = readEnvFile(envPath);
const url = env.PUBLIC_SUPABASE_URL;
const key = env.PUBLIC_SUPABASE_ANON_KEY;

if (!url?.startsWith('https://') || !key?.startsWith('eyJ')) {
	console.error('Expected PUBLIC_SUPABASE_URL (https://…) and JWT anon key (eyJ…) in .env');
	process.exit(1);
}

const vercelBin =
	process.env.VERCEL_BIN ||
	(fs.existsSync('/opt/homebrew/opt/node@22/bin/vercel')
		? '/opt/homebrew/opt/node@22/bin/vercel'
		: 'vercel');

function upsert(name, value) {
	try {
		run(vercelBin, ['env', 'rm', name, 'production', 'preview', 'development', '--yes']);
	} catch {
		// variable may not exist yet
	}
	run(vercelBin, ['env', 'add', name, 'production', 'preview', 'development'], `${value}\n`);
	console.log(`OK ${name}`);
}

console.log('Upserting env from .env…');
upsert('PUBLIC_SUPABASE_URL', url);
upsert('PUBLIC_SUPABASE_ANON_KEY', key);

console.log('Redeploying production…');
console.log(run(vercelBin, ['deploy', '--prod', '--yes']));
console.log('Done.');
