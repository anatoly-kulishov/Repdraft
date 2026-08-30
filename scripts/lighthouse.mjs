#!/usr/bin/env node
/**
 * Mobile performance Lighthouse against preview/dev.
 * Usage: npm run preview & npm run lighthouse:mobile
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const outDir = path.join(root, '.tmp');
const urlArg = process.argv.find((a) => a.startsWith('--url='));
const url = urlArg?.slice('--url='.length) ?? 'http://127.0.0.1:4173/';

fs.mkdirSync(outDir, { recursive: true });
const jsonPath = path.join(outDir, 'lighthouse-mobile.json');

const args = [
	'lighthouse',
	url,
	'--only-categories=performance,accessibility,best-practices',
	'--form-factor=mobile',
	'--screenEmulation.mobile=true',
	'--throttling-method=simulate',
	'--output=json',
	`--output-path=${jsonPath}`,
	'--chrome-flags=--headless --no-sandbox'
];

const result = spawnSync('npx', args, { encoding: 'utf8', stdio: 'inherit' });

if (result.status !== 0) {
	process.exit(result.status ?? 1);
}

if (fs.existsSync(jsonPath)) {
	const report = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
	const perf = report.categories?.performance;
	const audits = report.audits ?? {};
	console.log('\n--- Lighthouse mobile ---');
	console.log('URL:', url);
	console.log('Performance:', perf?.score != null ? Math.round(perf.score * 100) : 'n/a');
	for (const key of [
		'first-contentful-paint',
		'largest-contentful-paint',
		'total-blocking-time',
		'speed-index',
		'interactive'
	]) {
		if (audits[key]?.displayValue) console.log(`${key}:`, audits[key].displayValue);
	}
	console.log('JSON report:', jsonPath);
}
