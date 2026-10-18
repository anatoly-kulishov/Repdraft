import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

function publicUrl(): string {
	return (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim().replace(/\/$/, '');
}

function publicAnonKey(): string {
	return (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
}

export function isSupabaseConfigured(): boolean {
	const url = publicUrl();
	const key = publicAnonKey();
	return url.startsWith('https://') && (key.startsWith('eyJ') || key.startsWith('sb_'));
}

export function getSupabase(): SupabaseClient | null {
	if (!isSupabaseConfigured()) return null;
	if (!client) {
		client = createClient(publicUrl(), publicAnonKey(), {
			auth: {
				storage: AsyncStorage,
				autoRefreshToken: true,
				persistSession: true,
				detectSessionInUrl: false
			}
		});
	}
	return client;
}
