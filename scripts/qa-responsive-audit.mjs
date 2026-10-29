#!/usr/bin/env node
// Responsive audit across all routes x viewports.
// Waits for splash (data-boot-pending) to clear + settle, checks overflow & key metrics.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const outDir = path.join(os.tmpdir(), 'repdraft-qa');
fs.mkdirSync(outDir, { recursive: true });
const base = process.env.QA_BASE || 'http://localhost:5199';

const candidates = [
	'/Users/kulishov.a3/.npm/_npx/f0a362733743bae2/node_modules/playwright/index.mjs',
	'/Users/kulishov.a3/.npm/_npx/c61c9351a0dbcfa7/node_modules/playwright/index.mjs',
	'/Users/kulishov.a3/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs',
	'/Users/kulishov.a3/.npm/_npx/381cec31605a419a/node_modules/playwright/index.mjs',
	'/Users/kulishov.a3/.npm/_npx/86170c4cd1c5da32/node_modules/playwright/index.mjs',
	'/Users/kulishov.a3/.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs'
];
const entry = candidates.find((p) => fs.existsSync(p));
if (!entry) {
	console.error('No playwright found');
	process.exit(1);
}
const { chromium } = await import(pathToFileURL(entry).href);

// Routes that hang or are heavy get their own handling.
const routes = [
	['/', 'home'],
	['/exercises', 'exercises'],
	['/progress', 'progress'],
	['/clients', 'clients'],
	['/program', 'program'],
	['/records', 'records'],
	['/profile', 'profile'],
	['/auth', 'auth'],
	['/builder', 'builder'],
	['/settings', 'settings'],
	['/workouts', 'workouts'],
	['/lab', 'lab'],
	['/coach', 'coach'],
	['/articles', 'articles']
];
const viewports = [320, 360, 390, 414, 768, 1024, 1280, 1440, 1920];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(30000);

const results = {};

// Wait for splash to clear and network settle.
async function settle(route) {
	try {
		await page.waitForFunction(() => !document.documentElement.hasAttribute('data-boot-pending'), {
			timeout: 25000
		});
	} catch {
		/* ignore - may not boot */
	}
	await page.waitForTimeout(300);
}

async function audit(route, name, width) {
	await page.setViewportSize({ width, height: 900 });
	await page.goto(`${base}${route}`, { waitUntil: 'domcontentloaded' });
	await settle(route);

	const info = await page.evaluate(() => {
		const overflowX = document.documentElement.scrollWidth - window.innerWidth;
		const tabs = [...document.querySelectorAll('.shell-nav-tabbar__grid > .tab-link')].map(
			(el) => {
				const r = el.getBoundingClientRect();
				return { t: (el.textContent || '').trim().slice(0, 12), h: Math.round(r.height), top: Math.round(r.top) };
			}
		);
		const issues = [];
		if (overflowX > 2) issues.push(`overflow-x:+${Math.round(overflowX)}px`);
		if (tabs.length && new Set(tabs.map((t) => t.top)).size > 1) issues.push('tab-wrap');

		// Detect elements overflowing right edge
		const overflowEls = [];
		for (const el of document.querySelectorAll('*')) {
			const r = el.getBoundingClientRect();
			if (r.width < 1 || r.height < 1) continue;
			const style = getComputedStyle(el);
			if (style.visibility === 'hidden' || style.display === 'none') continue;
			if (r.right > window.innerWidth + 2 || r.left < -2) {
				const label = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24) || el.tagName;
				// Only report leaf-ish / meaningful elements to reduce noise
				if (r.width > 40 && el.children.length <= 1) overflowEls.push({ tag: el.tagName, label, r: Math.round(r.width), cls: String(el.className).slice(0, 40) });
			}
		}

		const boot = document.documentElement.hasAttribute('data-boot-pending');
		const title = document.title;
		return { boot, title, overflowX: Math.round(overflowX), overflowEls: overflowEls.slice(0, 6), tabs, issues };
	});

	const key = `${name}@${width}`;
	results[key] = info;
	const detail = [info.issues.join(' | ')].filter(Boolean);
	if (info.overflowEls.length) detail.push(`els:${info.overflowEls.map((e) => `${e.tag}.${e.cls}`).join(',')}`);
	console.log(`${key.padEnd(22)} boot=${info.boot} overflowX=${info.overflowX} ${detail.join('  ')}`);
}

// Scope targets to specific routes for full viewport matrix; others spot-check.
for (const [route, name] of routes) {
	for (const width of viewports) {
		await audit(route, name, width);
	}
}

fs.writeFileSync(path.join(outDir, 'qa-responsive.json'), JSON.stringify(results, null, 2));
await browser.close();
console.log('\ndone', path.join(outDir, 'qa-responsive.json'));