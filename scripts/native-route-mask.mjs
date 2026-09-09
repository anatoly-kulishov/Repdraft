/**
 * Park web-only Kit endpoints outside `src/routes` during APP_TARGET=capacitor builds
 * (api delete, og images, sitemap, robots). Restored in `finally`.
 *
 * Do not rename in-place with a suffix — Kit would still treat `*.__web_only__` as routes.
 */
import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = join(import.meta.dirname, '..');
const PARK = join(root, '.tmp/native-route-mask');

const PATHS = [
	'src/routes/api',
	'src/routes/og',
	'src/routes/sitemap.xml',
	'src/routes/robots.txt'
];

const LEGACY_SUFFIX = '.__web_only__';

const mode = process.argv[2];
if (mode !== 'hide' && mode !== 'show') {
	console.error('Usage: node scripts/native-route-mask.mjs hide|show');
	process.exit(1);
}

/** Clean leftover in-place renames from the first mask implementation. */
function clearLegacyMasks() {
	for (const rel of PATHS) {
		const legacy = join(root, `${rel}${LEGACY_SUFFIX}`);
		if (!existsSync(legacy)) continue;
		const live = join(root, rel);
		if (!existsSync(live)) {
			renameSync(legacy, live);
		} else {
			rmSync(legacy, { recursive: true, force: true });
		}
	}
}

clearLegacyMasks();

for (const rel of PATHS) {
	const live = join(root, rel);
	const parked = join(PARK, rel.replace(/^src\/routes\//, ''));
	if (mode === 'hide') {
		if (!existsSync(live)) continue;
		mkdirSync(dirname(parked), { recursive: true });
		if (existsSync(parked)) rmSync(parked, { recursive: true, force: true });
		renameSync(live, parked);
	} else if (existsSync(parked)) {
		mkdirSync(dirname(live), { recursive: true });
		if (existsSync(live)) rmSync(live, { recursive: true, force: true });
		renameSync(parked, live);
	}
}
