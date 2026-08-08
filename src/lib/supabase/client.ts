import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/** Public anon JWT for this Supabase project (safe in the browser; RLS still applies). */
const PROJECT_URL = 'https://eljdfxkcxjbgwvimvtkl.supabase.co';
const PROJECT_ANON_KEY =
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsamRmeGtjeGpiZ3d2aW12dGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNDkwMzMsImV4cCI6MjEwMDcyNTAzM30.Hd7BK5O3cvPUR3dyFBn0qckTxr0esNzLcQ5D736Thxc';

function publicUrl(): string {
	const fromEnv = (env.PUBLIC_SUPABASE_URL ?? '').trim().replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
	if (fromEnv.startsWith('https://')) return fromEnv;
	return PROJECT_URL;
}

function publicAnonKey(): string {
	let key = (env.PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
	// Repair truncated eyJ… paste and reject swapped URL-as-key from bad Vercel env.
	if (key.startsWith('yJhbGciOi') && !key.startsWith('eyJ')) {
		key = `e${key}`;
	}
	if (key.startsWith('eyJ')) return key;
	return PROJECT_ANON_KEY;
}

export function isSupabaseConfigured(): boolean {
	return Boolean(publicUrl().startsWith('https://') && publicAnonKey().startsWith('eyJ'));
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
