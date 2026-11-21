import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 4199);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

/**
 * Web E2E only: the React Native client is type-checked (`npm run check:mobile`)
 * and cannot run in a browser.
 *
 * The suite runs against the production adapter-node build (not Vite dev) so it
 * catches prerender / SSR / hydration problems. `scripts/e2e-server.mjs` builds
 * and serves on demand; set `E2E_SKIP_BUILD=1` to reuse an existing `build/`.
 */
export default defineConfig({
	testDir: './tests/e2e',
	timeout: 90_000,
	expect: { timeout: 10_000 },
	fullyParallel: true,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 1 : 0,
	workers: process.env.CI ? 2 : undefined,
	reporter: process.env.CI
		? [['github'], ['html', { open: 'never' }]]
		: [['list'], ['html', { open: 'never' }]],
	use: {
		baseURL: BASE_URL,
		// Primary audience + deterministic UI copy. `/en/*` mirrors still force English.
		locale: 'ru-RU',
		// The SW precaches ~1300 thumbs; E2E needs deterministic HTML, not offline QA.
		serviceWorkers: 'block',
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
		video: 'off'
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		}
	],
	webServer: {
		command: 'node scripts/e2e-server.mjs',
		url: `${BASE_URL}/tools`,
		reuseExistingServer: !process.env.CI,
		timeout: 360_000,
		stdout: 'pipe',
		stderr: 'pipe',
		env: {
			E2E_PORT: String(PORT),
			E2E_ORIGIN: BASE_URL
		}
	}
});
