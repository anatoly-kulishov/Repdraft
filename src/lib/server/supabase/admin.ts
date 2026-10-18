import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function publicUrl(): string {
	return (publicEnv.PUBLIC_SUPABASE_URL ?? '')
		.trim()
		.replace(/\/rest\/v1\/?$/, '')
		.replace(/\/$/, '');
}

function serviceRoleKey(): string {
	return (privateEnv.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
}

/** Server-only Supabase client (service role). Null when URL/key missing. */
export function getSupabaseAdmin(): SupabaseClient | null {
	const url = publicUrl();
	const key = serviceRoleKey();
	if (!url.startsWith('https://') || !key) return null;
	return createClient(url, key, {
		auth: {
			persistSession: false,
			autoRefreshToken: false
		}
	});
}

export function isExerciseRagConfigured(): boolean {
	return getSupabaseAdmin() !== null;
}
