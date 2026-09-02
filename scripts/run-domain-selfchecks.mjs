/**
 * Run all domain *.selfcheck.ts files with the $lib / extensionless loader.
 * Usage: node scripts/run-domain-selfchecks.mjs
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const register = join(here, 'register-domain-selfcheck.mjs');

const checks = [
	'filters',
	'workout',
	'session',
	'records',
	'clips',
	'inputLimits',
	'authFlow',
	'greetingName',
	'localCacheUser',
	'catalogCover',
	'exerciseName',
	'articles',
	'cloudSync',
	'prefs',
	'exportData',
	'pwaInstall',
	'exerciseScore',
	'onboarding',
	'home',
	'docMarkdown'
];

for (const name of checks) {
	const file = join(root, 'src/lib/domain', `${name}.selfcheck.ts`);
	const result = spawnSync(
		process.execPath,
		['--import', register, '--experimental-strip-types', file],
		{ stdio: 'inherit', cwd: root }
	);
	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
}

const localeCheck = join(root, 'src/lib/i18n/locale.selfcheck.ts');
const localeResult = spawnSync(
	process.execPath,
	['--import', register, '--experimental-strip-types', localeCheck],
	{ stdio: 'inherit', cwd: root }
);
if (localeResult.status !== 0) {
	process.exit(localeResult.status ?? 1);
}

const sitemapCheck = join(root, 'src/lib/seo/sitemap.selfcheck.ts');
const sitemapResult = spawnSync(
	process.execPath,
	['--import', register, '--experimental-strip-types', sitemapCheck],
	{ stdio: 'inherit', cwd: root }
);
if (sitemapResult.status !== 0) {
	process.exit(sitemapResult.status ?? 1);
}
