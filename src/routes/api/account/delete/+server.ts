import { env as publicEnv } from '$env/dynamic/public';
import { env as privateEnv } from '$env/dynamic/private';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const USER_TABLES = [
	'technique_clips',
	'workout_sessions',
	'personal_records',
	'workout_plans'
] as const;

const CLIP_BUCKET = 'technique-gifs';
const REMOVE_CHUNK = 80;

function publicUrl(): string {
	return (publicEnv.PUBLIC_SUPABASE_URL ?? '').trim().replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
}

function anonKey(): string {
	return (publicEnv.PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
}

function serviceRoleKey(): string {
	return (privateEnv.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
}

function webOriginAllowlist(): string[] {
	const origins = [
		(publicEnv.PUBLIC_SITE_URL ?? '').trim().replace(/\/$/, ''),
		(publicEnv.PUBLIC_WEB_ORIGIN ?? '').trim().replace(/\/$/, '')
	].filter((o) => o.startsWith('https://') || o.startsWith('http://'));
	return [...new Set(origins)];
}

function corsHeaders(request: Request): HeadersInit {
	const origin = request.headers.get('origin') ?? '';
	const allow = webOriginAllowlist();
	const headers: Record<string, string> = {
		'Access-Control-Allow-Methods': 'POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
		'Access-Control-Max-Age': '86400'
	};
	/* Capacitor / custom-scheme clients may omit Origin or send capacitor:// / ionic:// */
	if (
		!origin ||
		origin.startsWith('capacitor://') ||
		origin.startsWith('ionic://') ||
		allow.includes(origin)
	) {
		headers['Access-Control-Allow-Origin'] = origin || '*';
		if (origin) headers.Vary = 'Origin';
	}
	return headers;
}

function jsonWithCors(request: Request, body: unknown, init?: ResponseInit) {
	const headers = new Headers(init?.headers);
	const cors = corsHeaders(request);
	for (const [k, v] of Object.entries(cors)) headers.set(k, v);
	return json(body, { ...init, headers });
}

async function listUserGifPaths(admin: SupabaseClient, userId: string): Promise<string[]> {
	const paths: string[] = [];
	const { data, error } = await admin.storage.from(CLIP_BUCKET).list(userId, {
		limit: 1000,
		offset: 0
	});
	if (error) throw error;
	for (const item of data ?? []) {
		if (!item.name || item.name.endsWith('/')) continue;
		if (item.name.toLowerCase().endsWith('.gif')) {
			paths.push(`${userId}/${item.name}`);
		}
	}
	return paths;
}

async function removeStoragePaths(admin: SupabaseClient, paths: string[]): Promise<void> {
	const unique = [...new Set(paths.filter(Boolean))];
	for (let i = 0; i < unique.length; i += REMOVE_CHUNK) {
		const chunk = unique.slice(i, i + REMOVE_CHUNK);
		const { error } = await admin.storage.from(CLIP_BUCKET).remove(chunk);
		if (error) throw error;
	}
}

/** Preflight for native shell (absolute PUBLIC_WEB_ORIGIN fetch). */
export const OPTIONS: RequestHandler = async ({ request }) =>
	new Response(null, { status: 204, headers: corsHeaders(request) });

/** Delete the signed-in Auth user and their cloud rows (152-FZ / GDPR right to erasure). */
export const POST: RequestHandler = async ({ request }) => {
	const url = publicUrl();
	const anon = anonKey();
	const service = serviceRoleKey();

	if (!url.startsWith('https://') || !anon || !service) {
		return jsonWithCors(request, { error: 'auth.deleteNotConfigured' }, { status: 503 });
	}

	const authHeader = request.headers.get('authorization') ?? request.headers.get('Authorization');
	if (!authHeader?.toLowerCase().startsWith('bearer ')) {
		return jsonWithCors(request, { error: 'auth.deleteUnauthorized' }, { status: 401 });
	}

	const userClient = createClient(url, anon, {
		global: { headers: { Authorization: authHeader } },
		auth: { persistSession: false, autoRefreshToken: false }
	});

	const {
		data: { user },
		error: userError
	} = await userClient.auth.getUser();

	if (userError || !user) {
		return jsonWithCors(request, { error: 'auth.deleteUnauthorized' }, { status: 401 });
	}

	const admin = createClient(url, service, {
		auth: { persistSession: false, autoRefreshToken: false }
	});

	const { data: clips, error: clipsError } = await admin
		.from('technique_clips')
		.select('gif_path')
		.eq('user_id', user.id);

	if (clipsError && clipsError.code !== 'PGRST205' && clipsError.code !== '42P01') {
		console.error('account delete: technique_clips select', clipsError);
		return jsonWithCors(request, { error: 'auth.deleteFail' }, { status: 500 });
	}

	const dbGifPaths = (clips ?? [])
		.map((row) => (typeof row.gif_path === 'string' ? row.gif_path : null))
		.filter((path): path is string => Boolean(path));

	let listedPaths: string[] = [];
	try {
		listedPaths = await listUserGifPaths(admin, user.id);
	} catch (err) {
		console.error('account delete: storage.list', err);
		return jsonWithCors(request, { error: 'auth.deleteFail' }, { status: 500 });
	}

	try {
		await removeStoragePaths(admin, [...dbGifPaths, ...listedPaths]);
	} catch (err) {
		console.error('account delete: storage.remove', err);
		return jsonWithCors(request, { error: 'auth.deleteFail' }, { status: 500 });
	}

	{
		const { error } = await admin.from('technique_clip_reports').delete().eq('reporter_id', user.id);
		if (error && error.code !== 'PGRST205' && error.code !== '42P01') {
			console.error('account delete: technique_clip_reports reporter', error);
			return jsonWithCors(request, { error: 'auth.deleteFail' }, { status: 500 });
		}
	}

	{
		const { data: ownClips } = await admin.from('technique_clips').select('id').eq('user_id', user.id);
		const clipIds = (ownClips ?? [])
			.map((row) => (typeof row.id === 'string' ? row.id : null))
			.filter((id): id is string => Boolean(id));
		if (clipIds.length > 0) {
			const { error } = await admin.from('technique_clip_reports').delete().in('clip_id', clipIds);
			if (error && error.code !== 'PGRST205' && error.code !== '42P01') {
				console.error('account delete: technique_clip_reports on clips', error);
				return jsonWithCors(request, { error: 'auth.deleteFail' }, { status: 500 });
			}
		}
	}

	for (const table of USER_TABLES) {
		const { error } = await admin.from(table).delete().eq('user_id', user.id);
		if (error && error.code !== 'PGRST205' && error.code !== '42P01') {
			console.error(`account delete: ${table}`, error);
			return jsonWithCors(request, { error: 'auth.deleteFail' }, { status: 500 });
		}
	}

	const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
	if (deleteError) {
		console.error('account delete: auth.admin.deleteUser', deleteError);
		return jsonWithCors(request, { error: 'auth.deleteFail' }, { status: 500 });
	}

	return jsonWithCors(request, { ok: true });
};
