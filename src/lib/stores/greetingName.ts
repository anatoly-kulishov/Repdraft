import { browser } from '$app/environment';
import { sanitizeGreetingName } from '$lib/domain/greetingName';
import { readGreetingName, writeGreetingName } from '$lib/storage/localGreetingName';
import { getSupabase } from '$lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { writable } from 'svelte/store';

function metaGreetingName(user: User | null | undefined): string | null {
	const raw = user?.user_metadata?.greeting_name;
	if (typeof raw !== 'string') return null;
	const value = sanitizeGreetingName(raw);
	return value || null;
}

function createGreetingNameStore() {
	const { subscribe, set } = writable('');

	return {
		subscribe,
		bindUser(user: User | null) {
			if (!browser || !user?.id) {
				set('');
				return;
			}
			const local = readGreetingName(user.id);
			if (local !== null) {
				set(local);
				return;
			}
			set(metaGreetingName(user) ?? '');
		},
		async save(raw: string, userId: string): Promise<void> {
			if (!browser || !userId) return;
			const sanitized = sanitizeGreetingName(raw);
			set(sanitized);
			writeGreetingName(userId, sanitized || null);

			const supabase = getSupabase();
			if (!supabase) return;
			const { error } = await supabase.auth.updateUser({
				data: { greeting_name: sanitized || null }
			});
			if (error) throw error;
		}
	};
}

export const greetingName = createGreetingNameStore();
