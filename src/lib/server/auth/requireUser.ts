import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

function publicUrl(): string {
	return (publicEnv.PUBLIC_SUPABASE_URL ?? '')
		.trim()
		.replace(/\/rest\/v1\/?$/, '')
		.replace(/\/$/, '');
}

function anonKey(): string {
	return (publicEnv.PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
}

function serviceRoleKey(): string {
	return (privateEnv.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
}

export type RequireUserOk = {
	ok: true;
	user: User;
	admin: SupabaseClient;
	authHeader: string;
};

export type RequireUserFail = {
	ok: false;
	status: 401 | 503;
	errorKey: string;
};

export type RequireUserResult = RequireUserOk | RequireUserFail;

/**
 * Bearer JWT → auth.getUser() + service-role admin client.
 * Shared by account and billing routes.
 */
export async function requireUser(request: Request): Promise<RequireUserResult> {
	const url = publicUrl();
	const anon = anonKey();
	const service = serviceRoleKey();
	if (!url.startsWith('https://') || !anon || !service) {
		return { ok: false, status: 503, errorKey: 'errors.cloudOff' };
	}

	const authHeader = request.headers.get('authorization') ?? request.headers.get('Authorization');
	if (!authHeader?.toLowerCase().startsWith('bearer ')) {
		return { ok: false, status: 401, errorKey: 'errors.needAuth' };
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
		return { ok: false, status: 401, errorKey: 'errors.needAuth' };
	}

	const admin = createClient(url, service, {
		auth: { persistSession: false, autoRefreshToken: false }
	});
	return { ok: true, user, admin, authHeader };
}

export function webOriginAllowlist(): string[] {
	const origins = [
		(publicEnv.PUBLIC_SITE_URL ?? '').trim().replace(/\/$/, ''),
		(publicEnv.PUBLIC_WEB_ORIGIN ?? '').trim().replace(/\/$/, '')
	].filter((o) => o.startsWith('https://') || o.startsWith('http://'));
	return [...new Set(origins)];
}

export function accountCorsHeaders(
	request: Request,
	methods: string
): Record<string, string> {
	const origin = request.headers.get('origin') ?? '';
	const allow = webOriginAllowlist();
	const headers: Record<string, string> = {
		'Access-Control-Allow-Methods': methods,
		'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
		'Access-Control-Max-Age': '86400'
	};
	if (!origin || allow.includes(origin)) {
		headers['Access-Control-Allow-Origin'] = origin || '*';
		if (origin) headers.Vary = 'Origin';
	}
	return headers;
}
