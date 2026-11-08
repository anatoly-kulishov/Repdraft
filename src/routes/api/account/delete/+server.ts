import { AVATARS_BUCKET } from '$lib/domain/avatarImage';
import { accountCorsHeaders, requireUser } from '$lib/server/auth/requireUser';
import type { SupabaseClient } from '@supabase/supabase-js';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const USER_TABLES = [
	'technique_clips',
	'workout_sessions',
	'personal_records',
	'workout_plans',
	'entitlements'
] as const;

const CLIP_BUCKET = 'technique-gifs';
const AVATAR_BUCKET = AVATARS_BUCKET;
const REMOVE_CHUNK = 80;

function corsHeaders(request: Request): HeadersInit {
	return accountCorsHeaders(request, 'POST, OPTIONS');
}

function jsonWithCors(request: Request, body: unknown, init?: ResponseInit) {
	const headers = new Headers(init?.headers);
	const cors = corsHeaders(request);
	for (const [k, v] of Object.entries(cors)) headers.set(k, v);
	return json(body, { ...init, headers });
}

async function listUserStoragePaths(
	admin: SupabaseClient,
	bucket: string,
	userId: string,
	extFilter?: (name: string) => boolean
): Promise<string[]> {
	const paths: string[] = [];
	const { data, error } = await admin.storage.from(bucket).list(userId, {
		limit: 1000,
		offset: 0
	});
	if (error) throw error;
	for (const item of data ?? []) {
		if (!item.name || item.name.endsWith('/')) continue;
		if (extFilter && !extFilter(item.name)) continue;
		paths.push(`${userId}/${item.name}`);
	}
	return paths;
}

async function listUserGifPaths(admin: SupabaseClient, userId: string): Promise<string[]> {
	return listUserStoragePaths(admin, CLIP_BUCKET, userId, (name) =>
		name.toLowerCase().endsWith('.gif')
	);
}

async function listUserAvatarPaths(admin: SupabaseClient, userId: string): Promise<string[]> {
	return listUserStoragePaths(admin, AVATAR_BUCKET, userId, (name) =>
		/\.(webp|jpe?g)$/i.test(name)
	);
}

async function removeStoragePaths(
	admin: SupabaseClient,
	bucket: string,
	paths: string[]
): Promise<void> {
	const unique = [...new Set(paths.filter(Boolean))];
	for (let i = 0; i < unique.length; i += REMOVE_CHUNK) {
		const chunk = unique.slice(i, i + REMOVE_CHUNK);
		const { error } = await admin.storage.from(bucket).remove(chunk);
		if (error) throw error;
	}
}

/** Preflight for cross-origin account delete (PUBLIC_WEB_ORIGIN). */
export const OPTIONS: RequestHandler = async ({ request }) =>
	new Response(null, { status: 204, headers: corsHeaders(request) });

/** Delete the signed-in Auth user and their cloud rows (152-FZ / GDPR right to erasure). */
export const POST: RequestHandler = async ({ request }) => {
	const gate = await requireUser(request);
	if (!gate.ok) {
		const errorKey =
			gate.status === 503
				? 'auth.deleteNotConfigured'
				: gate.status === 401
					? 'auth.deleteUnauthorized'
					: gate.errorKey;
		return jsonWithCors(request, { error: errorKey }, { status: gate.status });
	}
	const { user, admin } = gate;

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

	let avatarPaths: string[] = [];
	try {
		avatarPaths = await listUserAvatarPaths(admin, user.id);
	} catch (err) {
		/* Bucket may not exist yet in older projects — do not block account wipe. */
		console.warn('account delete: avatars.list', err);
	}

	try {
		await removeStoragePaths(admin, CLIP_BUCKET, [...dbGifPaths, ...listedPaths]);
		if (avatarPaths.length > 0) {
			await removeStoragePaths(admin, AVATAR_BUCKET, avatarPaths);
		}
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
