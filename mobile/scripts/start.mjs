#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
for (const file of [resolve(here, '../../.env'), resolve(here, '../.env')]) {
	if (existsSync(file)) process.loadEnvFile(file);
}
if (!process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.PUBLIC_SUPABASE_URL) {
	process.env.EXPO_PUBLIC_SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
}
if (!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY && process.env.PUBLIC_SUPABASE_ANON_KEY) {
	process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = process.env.PUBLIC_SUPABASE_ANON_KEY;
}

const cloud = Boolean(
	process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);
const origin = process.env.EXPO_PUBLIC_WEB_ORIGIN ?? '';
const isLocalDevOrigin = /^(http:\/\/)?(localhost|127\.0\.0\.1)/.test(origin);
console.log(
	`[repdraft] Expo Go must match SDK 57: https://expo.dev/go - or use a dev build for HealthKit. Supabase: ${cloud ? 'on' : 'off'}.`
);
if (isLocalDevOrigin) {
	console.log(
		'[repdraft] EXPO_PUBLIC_WEB_ORIGIN points at localhost/127.0.0.1 - this will not work from the iOS simulator or a physical phone.'
	);
	console.log(
		'[repdraft] Use your machine LAN IP (e.g. http://192.168.0.104:5173) to see exercise technique, AI and catalog media in dev.'
	);
}

const child = spawn('npx', ['expo', 'start', ...process.argv.slice(2)], {
	stdio: 'inherit',
	shell: true
});

child.on('exit', (code) => process.exit(code ?? 0));
