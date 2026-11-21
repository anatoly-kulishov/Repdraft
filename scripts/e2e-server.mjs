#!/usr/bin/env node
/**
 * Playwright webServer entrypoint: build once, then run the adapter-node bundle.
 *
 * Tests are hermetic: Supabase / AI / billing credentials are blanked so the app
 * boots in local-first guest mode and never calls a real third party. Only
 * PUBLIC_SITE_URL is kept, so canonical / hreflang assertions can compare against
 * the production origin.
 */
import { spawn } from 'node:child_process';

const port = Number(process.env.E2E_PORT ?? 4199);
const origin = process.env.E2E_ORIGIN ?? `http://localhost:${port}`;
const skipBuild = process.env.E2E_SKIP_BUILD === '1';

const env = {
	...process.env,
	PORT: String(port),
	HOST: '127.0.0.1',
	ORIGIN: origin,
	NODE_ENV: 'production',
	PUBLIC_SITE_URL: process.env.PUBLIC_SITE_URL || 'https://www.repdraft.ru',
	// Blank overrides beat the developer's `.env`: Vite does not re-read `.env`
	// for variables that already exist in process.env.
	PUBLIC_SUPABASE_URL: '',
	PUBLIC_SUPABASE_ANON_KEY: '',
	SUPABASE_SERVICE_ROLE_KEY: '',
	PUBLIC_TURNSTILE_SITE_KEY: '',
	AI_PROVIDER: '',
	GIGACHAT_API_KEY: '',
	YOOKASSA_SHOP_ID: '',
	YOOKASSA_SECRET_KEY: '',
	STRIPE_SECRET_KEY: '',
	STRIPE_WEBHOOK_SECRET: ''
};

function run(cmd, args) {
	return new Promise((resolve, reject) => {
		const child = spawn(cmd, args, { stdio: 'inherit', env });
		child.on('error', reject);
		child.on('exit', (code) => {
			if (code === 0) resolve();
			else reject(new Error(`${cmd} ${args.join(' ')} exited with ${code}`));
		});
	});
}

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

if (!skipBuild) {
	console.log('[e2e] building production bundle...');
	await run(npm, ['run', 'build']);
}

console.log(`[e2e] starting adapter-node on ${origin}`);
const server = spawn(process.execPath, ['build'], { stdio: 'inherit', env });

function shutdown(signal) {
	try {
		server.kill(signal);
	} catch {
		/* already gone */
	}
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
server.on('exit', (code) => process.exit(code ?? 0));
