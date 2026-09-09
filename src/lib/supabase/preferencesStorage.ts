/**
 * Capacitor Preferences storage adapter for supabase-js Auth.
 * iOS may clear WebView localStorage; Preferences survive app restarts.
 */
import { Preferences } from '@capacitor/preferences';
import type { SupportedStorage } from '@supabase/supabase-js';

export function createPreferencesAuthStorage(): SupportedStorage {
	return {
		async getItem(key: string): Promise<string | null> {
			const { value } = await Preferences.get({ key });
			return value;
		},
		async setItem(key: string, value: string): Promise<void> {
			await Preferences.set({ key, value });
		},
		async removeItem(key: string): Promise<void> {
			await Preferences.remove({ key });
		}
	};
}
