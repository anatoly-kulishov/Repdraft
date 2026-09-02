import { defineConfig, devices } from '@playwright/test';

const baseURL = (process.env.BASE_URL ?? 'http://127.0.0.1:5173').replace(/\/$/, '');

export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: 1,
	reporter: [
		['list'],
		['html', { open: 'never', outputFolder: '.tmp/playwright-report' }]
	],
	snapshotPathTemplate: '{testDir}/{testFileDir}/__snapshots__/{projectName}/{arg}{ext}',
	expect: {
		toHaveScreenshot: {
			maxDiffPixelRatio: 0.02,
			animations: 'disabled'
		}
	},
	use: {
		baseURL,
		trace: 'on-first-retry',
		locale: 'ru-RU',
		colorScheme: 'dark',
		serviceWorkers: 'block'
	},
	projects: [
		{
			name: 'mobile-dark',
			use: {
				...devices['iPhone 13'],
				viewport: { width: 390, height: 844 },
				isMobile: true,
				hasTouch: true
			}
		},
		{
			name: 'desktop-dark',
			use: {
				viewport: { width: 1280, height: 900 },
				isMobile: false,
				hasTouch: false
			}
		}
	],
	webServer: {
		command: 'npm run dev -- --host 127.0.0.1 --port 5173',
		url: baseURL,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000
	}
});
