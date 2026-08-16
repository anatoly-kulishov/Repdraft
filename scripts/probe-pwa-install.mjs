/**
 * Browser probes for PWA install hint cases.
 * Usage: node scripts/probe-pwa-install.mjs [baseUrl]
 */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import {
	isDesktopChromiumInstallSurface,
	isInstalledDisplayMode,
	resolvePwaManualGuide
} from '../src/lib/domain/pwaInstall.ts';

const base = process.argv[2] ?? 'http://127.0.0.1:5173';

const safariIphone =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const chromeIos =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1';

/** Domain logic (fast, deterministic). */
function probeDomain() {
	assert.equal(resolvePwaManualGuide({ ua: safariIphone }), 'ios-safari');
	assert.equal(resolvePwaManualGuide({ ua: chromeIos }), 'ios-chrome');
	assert.equal(resolvePwaManualGuide({ ua: safariIphone, hasChromiumRuntime: true }), null);
	assert.equal(
		isDesktopChromiumInstallSurface({ hasChromiumRuntime: true, finePointerHover: true }),
		true
	);
	assert.equal(isInstalledDisplayMode((q) => q.includes('standalone')), true);
	assert.equal(isInstalledDisplayMode(() => false, true), true);
	console.log('ok  domain logic');
}

async function bannerState(page) {
	const root = page.locator('.pwa-install');
	const visible = await root.count().then((n) => n > 0 && root.first().isVisible());
	if (!visible) return { visible: false };
	const title = await root.locator('.pwa-install__title').innerText();
	const hasInstallBtn = await root
		.getByRole('button', { name: /Установить|Install/i })
		.count()
		.then((n) => n > 0);
	const hasShareStep = await root.getByText(/Поделиться|Share/i).count().then((n) => n > 0);
	const hasChromeMenuStep = await root.getByText(/Меню|Menu/i).count().then((n) => n > 0);
	const hasDesktopFallback = await root
		.getByText(/Через меню|From the Chrome or Edge menu|Пока кнопка недоступна|If the button is not ready/i)
		.count()
		.then((n) => n > 0);
	return { visible: true, title, hasInstallBtn, hasShareStep, hasChromeMenuStep, hasDesktopFallback };
}

async function openHome(context, initScripts = []) {
	const page = await context.newPage();
	for (const fn of initScripts) {
		await page.addInitScript(fn);
	}
	await page.goto(`${base}/`, { waitUntil: 'networkidle', timeout: 30000 });
	// Install hint: related-apps check + ~500ms reveal.
	await page.waitForTimeout(1200);
	return page;
}

async function probeBrowser() {
	const browser = await chromium.launch({ headless: true });
	const results = [];

	try {
		// 1) Fresh desktop Chromium — Install button and/or desktop menu fallback (not Safari).
		{
			const ctx = await browser.newContext();
			const page = await openHome(ctx, [
				() => {
					localStorage.clear();
				}
			]);
			const state = await bannerState(page);
			assert.equal(state.visible, true, 'desktop should show install banner');
			assert.equal(state.hasShareStep, false, 'desktop must not show Safari Share steps');
			assert.equal(state.hasDesktopFallback || state.hasInstallBtn, true);
			results.push({ case: 'desktop-fresh', ...state });
			await ctx.close();
			console.log('ok  desktop fresh banner');
		}

		// 2) Pref installed + related apps empty → stale flag cleared, banner may show
		{
			const ctx = await browser.newContext();
			const page = await openHome(ctx, [
				() => {
					localStorage.clear();
					localStorage.setItem('repdraft:pwa-installed', '1');
				}
			]);
			const state = await bannerState(page);
			const flag = await page.evaluate(() => localStorage.getItem('repdraft:pwa-installed'));
			assert.equal(flag, null, 'stale pwa-installed cleared when related apps empty');
			assert.equal(state.visible, true, 'banner returns after uninstall/stale flag');
			results.push({ case: 'pref-installed-stale-cleared', flag, ...state });
			await ctx.close();
			console.log('ok  stale pwa-installed cleared when not in related apps');
		}

		// 3) Pref: dismissed → no banner
		{
			const ctx = await browser.newContext();
			const page = await openHome(ctx, [
				() => {
					localStorage.clear();
					localStorage.setItem('repdraft:install-hint-dismissed', '1');
				}
			]);
			const state = await bannerState(page);
			assert.equal(state.visible, false, 'dismissed pref hides banner');
			results.push({ case: 'pref-dismissed', ...state });
			await ctx.close();
			console.log('ok  dismiss pref hides banner');
		}

		// 4) Standalone display-mode → no banner
		{
			const ctx = await browser.newContext();
			const page = await openHome(ctx, [
				() => {
					localStorage.clear();
					const real = window.matchMedia.bind(window);
					window.matchMedia = (query) => {
						if (String(query).includes('display-mode: standalone')) {
							return {
								matches: true,
								media: query,
								onchange: null,
								addListener() {},
								removeListener() {},
								addEventListener() {},
								removeEventListener() {},
								dispatchEvent() {
									return false;
								}
							};
						}
						return real(query);
					};
				}
			]);
			const state = await bannerState(page);
			assert.equal(state.visible, false, 'standalone hides banner');
			results.push({ case: 'standalone', ...state });
			await ctx.close();
			console.log('ok  standalone display-mode hides banner');
		}

		// 5) getInstalledRelatedApps → webapp → no banner
		{
			const ctx = await browser.newContext();
			const page = await openHome(ctx, [
				() => {
					localStorage.clear();
					Object.defineProperty(navigator, 'getInstalledRelatedApps', {
						configurable: true,
						value: async () => [{ platform: 'webapp', url: '/manifest.webmanifest' }]
					});
				}
			]);
			// related-apps check is async; wait a bit more
			await page.waitForTimeout(400);
			const state = await bannerState(page);
			assert.equal(state.visible, false, 'related webapp hides banner');
			results.push({ case: 'related-webapp', ...state });
			await ctx.close();
			console.log('ok  getInstalledRelatedApps(webapp) hides banner');
		}

		// 6) Simulated BIP → Install button
		{
			const ctx = await browser.newContext();
			const page = await openHome(ctx, [
				() => {
					localStorage.clear();
					window.addEventListener(
						'DOMContentLoaded',
						() => {
							const ev = new Event('beforeinstallprompt');
							/** @type {any} */
							const e = ev;
							e.preventDefault = () => {};
							e.prompt = async () => {};
							e.userChoice = Promise.resolve({ outcome: 'accepted' });
							window.dispatchEvent(e);
						},
						{ once: true }
					);
				}
			]);
			// BIP on DOMContentLoaded may race with Svelte onMount listener — fire again after load
			await page.evaluate(() => {
				const ev = new Event('beforeinstallprompt');
				/** @type {any} */
				const e = ev;
				e.preventDefault = () => {};
				e.prompt = async () => {};
				e.userChoice = Promise.resolve({ outcome: 'accepted' });
				window.dispatchEvent(e);
			});
			await page.waitForTimeout(300);
			const state = await bannerState(page);
			assert.equal(state.visible, true, 'BIP should show banner');
			assert.equal(state.hasInstallBtn, true, 'BIP should show Install button');
			assert.equal(state.hasShareStep, false);
			results.push({ case: 'bip-prompt', ...state });
			await ctx.close();
			console.log('ok  beforeinstallprompt → Install button');
		}

		// 7) iPhone Safari UA without chromium runtime → Share steps
		{
			const ctx = await browser.newContext({
				userAgent: safariIphone,
				hasTouch: true,
				isMobile: true,
				viewport: { width: 390, height: 844 }
			});
			const page = await openHome(ctx, [
				() => {
					localStorage.clear();
					try {
						delete window.chrome;
					} catch {
						/* ignore */
					}
					Object.defineProperty(window, 'chrome', {
						configurable: true,
						get() {
							return undefined;
						}
					});
				}
			]);
			const state = await bannerState(page);
			assert.equal(state.visible, true, 'iOS Safari should show banner');
			assert.equal(state.hasShareStep, true, 'Safari iOS should show Share step');
			assert.equal(state.hasInstallBtn, false);
			results.push({ case: 'ios-safari-ua', ...state });
			await ctx.close();
			console.log('ok  iOS Safari → Share steps');
		}

		// 7b) Chrome iOS (CriOS) without window.chrome → Chrome menu steps
		{
			const ctx = await browser.newContext({
				userAgent: chromeIos,
				hasTouch: true,
				isMobile: true,
				viewport: { width: 390, height: 844 }
			});
			const page = await openHome(ctx, [
				() => {
					localStorage.clear();
					Object.defineProperty(window, 'chrome', {
						configurable: true,
						get() {
							return undefined;
						}
					});
				}
			]);
			const state = await bannerState(page);
			assert.equal(state.visible, true, 'Chrome iOS should show banner');
			assert.equal(state.hasInstallBtn, false);
			assert.equal(state.hasChromeMenuStep, true, 'Chrome iOS should show Menu step');
			results.push({ case: 'ios-chrome-ua', ...state });
			await ctx.close();
			console.log('ok  Chrome iOS → Menu steps');
		}

		// 7c) DevTools-like: Safari UA but window.chrome present → no iOS steps
		{
			const ctx = await browser.newContext({
				userAgent: safariIphone,
				hasTouch: true,
				isMobile: true,
				viewport: { width: 390, height: 844 }
			});
			const page = await openHome(ctx, [
				() => {
					localStorage.clear();
					window.chrome = window.chrome || { runtime: {} };
				}
			]);
			const state = await bannerState(page);
			assert.equal(state.hasShareStep ?? false, false, 'Chromium+Safari UA must not show Share');
			assert.equal(state.hasDesktopFallback ?? false, false);
			results.push({ case: 'devtools-spoof-ua', ...state });
			await ctx.close();
			console.log('ok  Chromium + Safari UA → no Safari Share steps');
		}

		// 8) Default theme is light when no storage
		{
			const ctx = await browser.newContext();
			const page = await openHome(ctx, [
				() => {
					localStorage.clear();
				}
			]);
			const theme = await page.locator('html').getAttribute('data-theme');
			assert.equal(theme, 'light', 'default theme is light');
			results.push({ case: 'default-theme', theme });
			await ctx.close();
			console.log('ok  default theme light');
		}

		// 9) Install click marks installed and hides
		{
			const ctx = await browser.newContext();
			const page = await openHome(ctx, [
				() => {
					localStorage.clear();
				}
			]);
			await page.evaluate(() => {
				const ev = new Event('beforeinstallprompt');
				/** @type {any} */
				const e = ev;
				e.preventDefault = () => {};
				e.prompt = async () => {};
				e.userChoice = Promise.resolve({ outcome: 'accepted' });
				window.dispatchEvent(e);
			});
			await page.waitForTimeout(300);
			await page.getByRole('button', { name: /Установить|Install/i }).click();
			await page.waitForTimeout(200);
			const state = await bannerState(page);
			const installed = await page.evaluate(() => localStorage.getItem('repdraft:pwa-installed'));
			assert.equal(state.visible, false, 'banner hides after install');
			assert.equal(installed, '1', 'marks pwa-installed');
			results.push({ case: 'install-accept', installed, ...state });
			await ctx.close();
			console.log('ok  Install accepted → hide + mark installed');
		}

		console.log('\nAll browser probes passed.');
		console.log(JSON.stringify(results, null, 2));
	} finally {
		await browser.close();
	}
}

probeDomain();
await probeBrowser();
