import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

function publicUrl(): string {
	return (env.PUBLIC_SUPABASE_URL ?? '').trim().replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
}

function publicAnonKey(): string {
	let key = (env.PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
	// Repair truncated eyJ… paste from bad env paste.
	if (key.startsWith('yJhbGciOi') && !key.startsWith('eyJ')) {
		key = `e${key}`;
	}
	return key;
}

export function isSupabaseConfigured(): boolean {
	const url = publicUrl();
	const key = publicAnonKey();
	return url.startsWith('https://') && (key.startsWith('eyJ') || key.startsWith('sb_'));
}

export function getSupabase(): SupabaseClient | null {
	if (!isSupabaseConfigured()) return null;
	if (!browser) return null;
	if (!client) {
		client = createClient(publicUrl(), publicAnonKey(), {
			auth: {
				persistSession: true,
				autoRefreshToken: true,
				detectSessionInUrl: true
			}
		});
	}
	return client;
}
