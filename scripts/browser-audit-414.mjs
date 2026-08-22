#!/usr/bin/env node
/** 414px manual UX audit — screenshots for key routes + live stress plan. */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = (process.env.BASE_URL ?? 'http://127.0.0.1:4173').replace(/\/$/, '');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, '.tmp/browser-audit-414');

const VIEWPORT = { width: 414, height: 896 };

const ROUTES = [
	['/', 'home'],
	['/workouts', 'workouts'],
	['/exercises', 'catalog-hub'],
	['/catalog/chest', 'catalog-zone'],
	['/builder', 'builder'],
	['/records', 'records'],
	['/auth', 'auth']
];

async function main() {
	await mkdir(outDir, { recursive: true });
	const browser = await chromium.launch();
	const now = new Date().toISOString();
	const planMany = {
		id: 'stress-plan-many',
		name: 'Stress · много упражнений',
		createdAt: now,
		updatedAt: now,
		exercises: ['0001', '0002', '0003'].map((exerciseId, i) => ({
			exerciseId,
			sets: 3,
			reps: 10,
			restSec: 60,
			groupId: i < 2 ? 'g-stress' : null
		}))
	};
	const active = {
		id: 'stress-active',
		planId: planMany.id,
		planName: planMany.name,
		startedAt: now,
		finishedAt: null,
		exercises: planMany.exercises.map((ex) => ({
			exerciseId: ex.exerciseId,
			groupId: ex.groupId,
			targetSets: ex.sets,
			targetReps: ex.reps,
			restSec: ex.restSec,
			sets: Array.from({ length: ex.sets }, () => ({
				weightKg: 40,
				reps: 10,
				completed: false,
				kind: 'work'
			}))
		}))
	};

	const context = await browser.newContext({
		viewport: VIEWPORT,
		isMobile: true,
		hasTouch: true,
		deviceScaleFactor: 2
	});
	await context.addInitScript((data) => {
		localStorage.setItem('repdraft:plans', JSON.stringify(data.plans));
		localStorage.setItem('repdraft:active-session', JSON.stringify(data.active));
	}, { plans: [planMany], active });

	const page = await context.newPage();

	for (const [path, name] of ROUTES) {
		const url = `${BASE}${path.trim()}`;
		await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
		await page.waitForTimeout(400);
		await page.screenshot({ path: join(outDir, `${name}.png`), fullPage: false });
		console.log(`shot ${name}`);
	}

	await page.goto(`${BASE}/live/stress-plan-many`, {
		waitUntil: 'networkidle',
		timeout: 30_000
	});
	await page.waitForSelector('.live-page, .live-set-weight', { timeout: 15_000 }).catch(() => null);
	await page.waitForTimeout(600);
	await page.screenshot({ path: join(outDir, 'live.png'), fullPage: false });
	console.log('shot live');

	await browser.close();
	console.log(`\nScreenshots: ${outDir}`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
