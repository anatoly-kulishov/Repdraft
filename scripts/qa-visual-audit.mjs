#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const outDir = path.join(os.tmpdir(), 'repdraft-qa');
fs.mkdirSync(outDir, { recursive: true });
const base = process.env.QA_BASE || 'http://localhost:5174';

const candidates = [
	'/Users/kulishov.a3/.npm/_npx/f0a362733743bae2/node_modules/playwright/index.mjs',
	'/Users/kulishov.a3/.npm/_npx/c61c9351a0dbcfa7/node_modules/playwright/index.mjs',
	'/Users/kulishov.a3/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs'
];
const entry = candidates.find((p) => fs.existsSync(p));
if (!entry) {
	console.error('Install playwright browsers: npx playwright@1.49.1 install chromium');
	process.exit(1);
}

const { chromium } = await import(pathToFileURL(entry).href);

const routes = [
	['/', 'home'],
	['/exercises', 'exercises'],
	['/progress', 'progress'],
	['/auth', 'auth'],
	['/builder', 'builder'],
	['/workouts', 'workouts'],
	['/achievements', 'achievements'],
	['/coach', 'coach'],
	['/history', 'history'],
	['/catalog/all', 'catalog-all']
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(30000);

const results = {};

async function auditRoute(route, name, theme) {
	await page.goto(`${base}${route}`, { waitUntil: 'domcontentloaded' });
	await page
		.waitForFunction(() => !document.documentElement.hasAttribute('data-boot-pending'), {
			timeout: 25000
		})
		.catch(() => undefined);
	await page.evaluate((t) => {
		document.documentElement.setAttribute('data-theme', t);
		document.documentElement.classList.toggle('dark', t === 'dark');
		try {
			localStorage.setItem('repdraft-theme', t);
		} catch {
			/* ignore */
		}
	}, theme);
	await page.waitForTimeout(500);
	const suffix = theme === 'dark' ? '-dark' : '';
	const shot = path.join(outDir, `qa-${name}${suffix}-390.png`);
	await page.screenshot({ path: shot, fullPage: false });
	const info = await page.evaluate(() => {
		const tabs = [...document.querySelectorAll('.shell-nav-tabbar__grid > .tab-link')].map(
			(el) => {
				const r = el.getBoundingClientRect();
				return {
					t: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 12),
					h: Math.round(r.height),
					w: Math.round(r.width),
					top: Math.round(r.top)
				};
			}
		);
		const issues = [];
		if (document.documentElement.scrollWidth > window.innerWidth + 2) issues.push('overflow-x');
		if (tabs.length && new Set(tabs.map((t) => t.top)).size > 1) issues.push('tab-wrap');
		if (tabs.some((t) => t.h > 0 && t.h < 48)) issues.push('tab-short');

		const shortHits = [];
		const selectors = [
			'button',
			'a.btn',
			'a.tab-link',
			'a.catalog-hub-chip',
			'[role="button"]',
			'.chip',
			'.app-chip',
			'.btn-primary',
			'.btn-secondary',
			'.btn-ghost',
			'.shell-nav-tabbar__grid > .tab-link'
		];
		const seen = new Set();
		for (const sel of selectors) {
			for (const el of document.querySelectorAll(sel)) {
				if (seen.has(el)) continue;
				seen.add(el);
				const r = el.getBoundingClientRect();
				if (r.width < 1 || r.height < 1) continue;
				if (r.bottom < 0 || r.top > window.innerHeight) continue;
				const style = getComputedStyle(el);
				if (style.visibility === 'hidden' || style.display === 'none') continue;
				if (style.pointerEvents === 'none') continue;
				if (r.height < 48 || r.width < 48) {
					const label = (el.textContent || el.getAttribute('aria-label') || el.className || '')
						.toString()
						.trim()
						.replace(/\s+/g, ' ')
						.slice(0, 36);
					shortHits.push({
						h: Math.round(r.height),
						w: Math.round(r.width),
						tag: el.tagName.toLowerCase(),
						label
					});
				}
			}
		}
		if (shortHits.length) {
			issues.push(`short-hit:${shortHits.length}`);
		}

		const tabbar = document.querySelector('.shell-nav-tabbar');
		if (tabbar && getComputedStyle(tabbar).display !== 'none') {
			const tr = tabbar.getBoundingClientRect();
			document.querySelectorAll('.btn-primary, .app-fab, .draft-dock').forEach((el) => {
				const r = el.getBoundingClientRect();
				if (r.height < 1) return;
				if (r.bottom > tr.top + 4 && r.top < tr.bottom - 4) {
					issues.push(`overlap-tab:${(el.className || '').toString().slice(0, 40)}`);
				}
			});
		}

		const mutedNearInvisible = [];
		document.querySelectorAll('.text-muted, [class*="text-muted"]').forEach((el) => {
			const c = getComputedStyle(el).color;
			const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
			if (!m) return;
			const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
			const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
			const bg = getComputedStyle(document.body).backgroundColor;
			const bm = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
			if (!bm) return;
			const [br, bgc, bb] = [Number(bm[1]), Number(bm[2]), Number(bm[3])];
			const blum = (0.2126 * br + 0.7152 * bgc + 0.0722 * bb) / 255;
			if (Math.abs(lum - blum) < 0.08) {
				mutedNearInvisible.push((el.textContent || '').trim().slice(0, 24));
			}
		});
		if (mutedNearInvisible.length) issues.push(`low-contrast-muted:${mutedNearInvisible.length}`);

		return {
			boot: document.documentElement.hasAttribute('data-boot-pending'),
			theme: document.documentElement.getAttribute('data-theme'),
			title: document.title,
			tabs,
			issues,
			shortHits: shortHits.slice(0, 12),
			bodyText: document.body.innerText.replace(/\s+/g, ' ').slice(0, 160)
		};
	});
	const key = theme === 'dark' ? `${name}-dark` : name;
	results[key] = { ...info, shot };
	console.log(key, JSON.stringify({ issues: info.issues, shortHits: info.shortHits, tabs: info.tabs }));
}

for (const theme of ['light', 'dark']) {
	for (const [route, name] of routes) {
		await auditRoute(route, name, theme);
	}
}

fs.writeFileSync(path.join(outDir, 'qa-audit.json'), JSON.stringify(results, null, 2));
await browser.close();
console.log('done', outDir);
