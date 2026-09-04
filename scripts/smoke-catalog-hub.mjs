#!/usr/bin/env node
/**
 * Smoke against today's MVP shell / catalog / workouts / PWA assets.
 * Usage:
 *   PREVIEW_URL=http://127.0.0.1:5173 npm run smoke:catalog-hub
 *   # or after build:
 *   npm run build && npm run preview -- --host 127.0.0.1 --port 4173 &
 *   PREVIEW_URL=http://127.0.0.1:4173 npm run smoke:catalog-hub
 */
import { access, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const base = (process.env.PREVIEW_URL ?? 'http://127.0.0.1:4173').replace(/\/$/, '');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

async function get(path) {
	const res = await fetch(`${base}${path}`);
	const text = await res.text();
	return { status: res.status, text, headers: res.headers };
}

function assert(cond, msg) {
	if (!cond) throw new Error(msg);
}

function assertIncludes(haystack, needles, label) {
	const missing = needles.filter((n) => !haystack.includes(n));
	assert(missing.length === 0, `${label}: missing ${missing.join(', ')}`);
}

async function assertFile(rel) {
	await access(join(root, rel));
}

// ——— Source components from today's redesign ———
for (const rel of [
	'src/lib/components/SubrouteBack.svelte',
	'src/lib/components/ScreenHeader.svelte',
	'src/lib/components/CatalogCategoryCard.svelte',
	'src/lib/components/CatalogEquipmentGrid.svelte'
]) {
	await assertFile(rel);
}

const homeSrc = await readFile(join(root, 'src/routes/+page.svelte'), 'utf8');
assert(!homeSrc.includes('HomeRecordsWidget'), 'home must not mount records widget');
assert(!homeSrc.includes('ArticleTeaserList'), 'home must not mount article teaser');
assert(!homeSrc.includes('HomeStatsStack'), 'home page must not mount analytics placeholder stats');
assert(homeSrc.includes('home-dashboard-aside'), 'home mid layout must keep recent in aside');

const catalogListSrc = await readFile(
	join(root, 'src/lib/components/CatalogExerciseList.svelte'),
	'utf8'
);
assert(
	!catalogListSrc.includes('filters = { ...filters, bodyPart: presetBodyPart, query }'),
	'catalog zone must not reset query from empty initialQuery on every keystroke'
);
assert(
	catalogListSrc.includes('detailFrom'),
	'catalog list must pass detailFrom for zone-aware exercise back links'
);
assert(
	catalogListSrc.includes('bodyPart: presetBodyPart as ExerciseFilters') ||
		catalogListSrc.includes('bodyPart: presetBodyPart'),
	'catalog zone must still lock bodyPart for the route'
);

// ——— Static PWA assets ———
for (const rel of [
	'static/icon-192-v2.png',
	'static/icon-512-v2.png',
	'static/icon-maskable-512-v2.png',
	'static/icon.svg',
	'static/apple-touch-icon-v2.png',
	'static/apple-touch-icon-precomposed-v2.png',
	'static/favicon.ico',
	'static/icon-boot.png',
	'static/manifest.webmanifest'
]) {
	await assertFile(rel);
}

const manifest = JSON.parse(await (await fetch(`${base}/manifest.webmanifest`)).text());
assert(Array.isArray(manifest.icons) && manifest.icons.length >= 3, 'manifest icons incomplete');
assert(
	manifest.icons.every((i) => i.type === 'image/png'),
	'manifest icons must be PNG only (iOS skips SVG)'
);
assert(
	!manifest.icons.some((i) => i.media),
	'manifest must not use icon media= (Safari icon pick is unreliable)'
);
assert(
	manifest.icons.some((i) => i.purpose === 'any' && i.sizes === '192x192'),
	'manifest missing 192 any PNG'
);
assert(
	manifest.icons.some((i) => i.purpose === 'any' && i.sizes === '512x512'),
	'manifest missing 512 any PNG'
);
assert(
	manifest.icons.every((i) => typeof i.src === 'string' && i.src.includes('-v2.')),
	'manifest icons must use -v2 URLs (Android icon cache bust)'
);
assert(
	manifest.icons.some((i) => i.purpose === 'maskable' && i.sizes === '512x512'),
	'manifest missing maskable 512 PNG'
);

const { status: appleStatus, headers: appleHeaders } = await get('/apple-touch-icon-v2.png');
assert(appleStatus === 200, `GET /apple-touch-icon-v2.png → ${appleStatus}`);
assert(
	String(appleHeaders.get('content-type') ?? '').includes('image/png'),
	'apple-touch-icon must be image/png'
);

const htmlHome = await get('/');
assert(htmlHome.status === 200, `GET / → ${htmlHome.status}`);
assert(
	htmlHome.text.includes('rel="apple-touch-icon"') && htmlHome.text.includes('/apple-touch-icon-v2.png'),
	'home HTML must declare apple-touch-icon PNG'
);
assert(
	!/rel="apple-touch-icon"[^>]*media=/.test(htmlHome.text),
	'apple-touch-icon must not use media= (breaks iOS)'
);

// ——— Home shell ———
{
	const { status, text } = await get('/');
	assert(status === 200, `GET / → ${status}`);
	assertIncludes(text, ['home-page'], 'home');
	assert(
		text.includes('home-dashboard') || text.includes('home-skeleton'),
		'home dashboard/skeleton missing'
	);
}

// ——— Catalog hub: zone grid + shortcut nav ———
{
	const { status, text } = await get('/exercises');
	assert(status === 200, `GET /exercises → ${status}`);
		assertIncludes(
		text,
		[
			'catalog-hub',
			'catalog-hub-grid',
			'catalog-hub-chips',
			'href="/catalog/all"',
			'href="/exercises/saved"',
			'href="/articles"',
			'href="/exercises/records"',
			'zone-card',
			'href="/catalog/legs"'
		],
		'catalog hub'
	);
	assert(
		!text.includes('class="article-teaser"'),
		'hub must not show article teaser block'
	);
	assert(!text.includes('href="/catalog/lower%20legs"'), 'hub must merge lower legs into legs');
}

// ——— Zone default landing (target/equipment browse when ≥2 chips; else list) ———
{
	const { status, text } = await get('/catalog/chest');
	assert(status === 200, `GET /catalog/chest → ${status}`);
	assertIncludes(
		text,
		[
			'screen-header',
			'screen-header-crumb',
			'screen-header--back-label',
			'class="catalog-target-grid catalog-hub-grid"',
			'zone-card',
			'target=pectorals',
			'browse=all',
			'href="/exercises"'
		],
		'catalog chest target browse'
	);
	assert(!text.includes('catalog-target-chips'), 'chest browse must not use chip row');
}

{
	const { status, text } = await get('/catalog/upper%20arms');
	assert(status === 200, `GET /catalog/upper arms → ${status}`);
	assertIncludes(
		text,
		[
			'class="catalog-target-grid catalog-hub-grid"',
			'target=biceps',
			'target=triceps',
			'browse=all'
		],
		'upper arms target browse'
	);
}

{
	const { status, text } = await get('/catalog/cardio');
	assert(status === 200, `GET /catalog/cardio → ${status}`);
	assertIncludes(
		text,
		[
			'class="catalog-target-grid catalog-hub-grid"',
			'equipment=',
			'browse=all',
			'href="/exercises"'
		],
		'cardio equipment browse'
	);
	assert(!text.includes('catalog-target-chips'), 'cardio browse must not use chip row');
}

{
	const { status, text } = await get('/catalog/shoulders');
	assert(status === 200, `GET /catalog/shoulders → ${status}`);
	assertIncludes(
		text,
		[
			'class="catalog-target-grid catalog-hub-grid"',
			'equipment=',
			'browse=all',
			'href="/exercises"'
		],
		'shoulders equipment browse'
	);
	assert(!text.includes('catalog-target-chips'), 'shoulders browse must not use chip row');
}

{
	const { status, text } = await get('/catalog/waist');
	assert(status === 200, `GET /catalog/waist → ${status}`);
	assertIncludes(
		text,
		[
			'class="catalog-target-grid catalog-hub-grid"',
			'equipment=',
			'browse=all',
			'href="/exercises"'
		],
		'waist equipment browse'
	);
	assert(!text.includes('catalog-target-chips'), 'waist browse must not use chip row');
}

// ——— Zone exercise list + filters (prerendered list when no target/equipment browse) ———
{
	const { status, text } = await get('/catalog/neck');
	assert(status === 200, `GET /catalog/neck → ${status}`);
	assertIncludes(
		text,
		['catalog-filters', 'catalog-page--list', 'href="/exercises"'],
		'catalog neck list'
	);
	assert(
		!text.includes('class="catalog-target-grid catalog-hub-grid"'),
		'neck must not use equipment/target browse grid (single equipment)'
	);
}

{
	const { status, text } = await get('/catalog/chest?target=pectorals');
	assert(status === 200, `GET /catalog/chest?target=pectorals → ${status}`);
	// ponytail: prerender load omits searchParams — chest default is target browse; list hydrates client-side.
	assertIncludes(text, ['catalog-zone-shell', 'target=pectorals', 'href="/exercises"'], 'chest target route shell');
}

// ——— Zone target browse (hub-style cards) ———
{
	const { status, text } = await get('/catalog/back');
	assert(status === 200, `GET /catalog/back → ${status}`);
	assertIncludes(
		text,
		[
			'class="catalog-target-grid catalog-hub-grid"',
			'zone-card',
			'browse=all',
			'target=lats'
		],
		'back target browse'
	);
	assert(!text.includes('catalog-target-chips'), 'zone browse must not use chip row');
}

{
	const { status, text } = await get('/catalog/legs');
	assert(status === 200, `GET /catalog/legs → ${status}`);
	assertIncludes(
		text,
		[
			'class="catalog-target-grid catalog-hub-grid"',
			'target=calves',
			'target=quads',
			'browse=all'
		],
		'merged legs target browse'
	);
}

{
	const { status, text } = await get('/catalog/back?target=lats');
	assert(status === 200, `GET /catalog/back?target=lats → ${status}`);
	// ponytail: prerender load omits searchParams on SSR — list/back crumb hydrate in the browser.
	assertIncludes(text, ['catalog-zone-shell'], 'back target route shell');
	assert(
		!/<[a-z][^>]*\bcatalog-zone-target-back\b/i.test(text),
		'target list must use single back affordance'
	);
}

// ——— Articles hub ———
{
	const { status, text } = await get('/articles');
	assert(status === 200, `GET /articles → ${status}`);
	assertIncludes(text, ['articles-hub', 'article-card', 'warmup-before-press'], 'articles hub');
}

// ——— Saved bookmarks subroute ———
{
	const { status, text } = await get('/exercises/saved');
	assert(status === 200, `GET /exercises/saved → ${status}`);
	assertIncludes(text, ['screen-header', 'screen-header-crumb', 'screen-header--back-label'], 'saved');
}

// ——— Records page ———
{
	const { status, text } = await get('/exercises/records');
	assert(status === 200, `GET /exercises/records → ${status}`);
	assert(text.includes('page-title') || text.includes('content-page'), 'records page markup missing');

	const legacy = await fetch(`${base}/records`, { redirect: 'manual' });
	assert(legacy.status === 308, `GET /records → ${legacy.status}, expected 308`);
}

// ——— Workouts list ———
{
	const { status, text } = await get('/workouts');
	assert(status === 200, `GET /workouts → ${status}`);
	assertIncludes(text, ['workouts-page'], 'workouts');
}

// ——— Exercise detail + from= plan deep-link ———
const indexRes = await fetch(`${base}/data/exercises.index.json`);
assert(indexRes.ok, 'exercises index missing');
const index = await indexRes.json();
const chest = index.find((ex) => ex.body_part === 'chest');
assert(chest?.id, 'no chest exercise in index');
const id = chest.id;

{
	const { status, text } = await get(`/exercise/${id}`);
	assert(status === 200, `GET /exercise/${id} → ${status}`);
	assertIncludes(
		text,
		['screen-header', 'screen-header-crumb', 'screen-header--back-label'],
		'exercise detail'
	);
}

{
	const from = '/workouts/demo-plan';
	const { status, text } = await get(`/exercise/${id}?from=${encodeURIComponent(from)}`);
	assert(status === 200, `GET /exercise/${id}?from=… → ${status}`);
	assert(text.includes('screen-header-crumb'), 'exercise detail from= must keep ScreenHeader back');
}

// ——— Settings: legacy URL redirects to profile ———
{
	const settingsLoad = await readFile(join(root, 'src/routes/settings/+page.ts'), 'utf8');
	assert(
		settingsLoad.includes("redirect(308, '/auth')") || settingsLoad.includes('redirect(308, "/auth")'),
		'settings route must redirect to /auth'
	);
	const res = await fetch(`${base}/settings`, { redirect: 'manual' });
	assert(
		res.status === 308 || res.status === 307,
		`GET /settings → ${res.status} (expected redirect)`
	);
	const location = res.headers.get('location') ?? '';
	assert(location.endsWith('/auth'), `GET /settings location → ${location}`);
}

// ——— Workout plan preview source has desktop back (plan id is dynamic) ———
{
	const src = await readFile(join(root, 'src/routes/workouts/[planId]/+page.svelte'), 'utf8');
	assert(src.includes('ScreenHeader'), 'workout plan preview must use ScreenHeader');
	assert(src.includes('workout-preview-start'), 'workout plan preview must keep desktop start block');
}

console.log('smoke-catalog-hub: ok', { base, exerciseId: id });
