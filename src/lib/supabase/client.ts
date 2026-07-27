import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
	return Boolean(env.PUBLIC_SUPABASE_URL && env.PUBLIC_SUPABASE_ANON_KEY);
}

export function getSupabase(): SupabaseClient | null {
	if (!isSupabaseConfigured()) return null;
	if (!browser) return null;
	if (!client) {
		client = createClient(env.PUBLIC_SUPABASE_URL!, env.PUBLIC_SUPABASE_ANON_KEY!, {
			auth: {
				persistSession: true,
				autoRefreshToken: true,
				detectSessionInUrl: true
			}
		});
	}
	return client;
}
