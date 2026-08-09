/**
 * Backfill Cache-Control on existing public technique GIFs.
 *
 * Needs service role (bypasses RLS; can list/update all objects):
 *   PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env
 *
 *   node --env-file=.env scripts/backfill-technique-gif-cache.mjs
 *   node --env-file=.env scripts/backfill-technique-gif-cache.mjs --dry-run
 */
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'technique-gifs';
const CACHE_CONTROL = '31536000';
const dryRun = process.argv.includes('--dry-run');

const url = process.env.PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !key) {
	console.error('Need PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env');
	process.exit(1);
}

const supabase = createClient(url, key, {
	auth: { persistSession: false, autoRefreshToken: false }
});

async function listLevel(prefix) {
	const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
		limit: 1000,
		sortBy: { column: 'name', order: 'asc' }
	});
	if (error) throw error;
	return data ?? [];
}

function isGifObject(entry) {
	return Boolean(entry?.name) && entry.name.toLowerCase().endsWith('.gif') && entry.id != null;
}

function isFolder(entry) {
	// Storage folders have null id in list responses
	return Boolean(entry?.name) && entry.id == null;
}

async function collectGifPaths() {
	const paths = [];
	const roots = await listLevel('');
	for (const entry of roots) {
		if (isGifObject(entry)) {
			paths.push(entry.name);
			continue;
		}
		if (!isFolder(entry)) continue;
		const nested = await listLevel(entry.name);
		for (const file of nested) {
			if (isGifObject(file)) paths.push(`${entry.name}/${file.name}`);
		}
	}
	return paths;
}

async function rewriteCacheControl(path) {
	const { data: blob, error: dlError } = await supabase.storage.from(BUCKET).download(path);
	if (dlError) throw dlError;

	const { error: upError } = await supabase.storage.from(BUCKET).update(path, blob, {
		contentType: 'image/gif',
		cacheControl: CACHE_CONTROL,
		upsert: true
	});
	if (upError) throw upError;
}

const paths = await collectGifPaths();
console.log(`Found ${paths.length} GIF(s) in ${BUCKET}${dryRun ? ' (dry-run)' : ''}`);

let ok = 0;
let fail = 0;
for (const path of paths) {
	try {
		if (dryRun) {
			console.log(`would update ${path}`);
		} else {
			await rewriteCacheControl(path);
			console.log(`updated ${path}`);
		}
		ok += 1;
	} catch (err) {
		fail += 1;
		console.error(`fail ${path}:`, err?.message ?? err);
	}
}

console.log(`done ok=${ok} fail=${fail} cacheControl=${CACHE_CONTROL}`);
if (fail > 0) process.exit(1);
