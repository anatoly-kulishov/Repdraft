import { browser } from '$app/environment';
import { greetingNameMatchesStored, sanitizeGreetingName } from '$lib/domain/greetingName';
import { getSupabase } from '$lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { get, writable } from 'svelte/store';

function metaGreetingName(user: User | null | undefined): string | null {
	const raw = user?.user_metadata?.greeting_name;
	if (typeof raw !== 'string') return null;
	const value = sanitizeGreetingName(raw);
	return value || null;
}

function createGreetingNameStore() {
	const store = writable('');
	const { subscribe, set } = store;

	return {
		subscribe,
		bindUser(user: User | null) {
			if (!browser || !user?.id) {
				set('');
				return;
			}
			set(metaGreetingName(user) ?? '');
		},
		/** Returns false when value is unchanged (no network). */
		async save(raw: string, userId: string): Promise<boolean> {
			if (!browser || !userId) return false;
			const sanitized = sanitizeGreetingName(raw);
			if (greetingNameMatchesStored(get(store), raw)) return false;
			const supabase = getSupabase();
			if (!supabase) throw new Error('errors.cloudOff');
			const { data, error } = await supabase.auth.updateUser({
				data: { greeting_name: sanitized || null }
			});
			if (error) throw error;
			set(metaGreetingName(data.user) ?? sanitized);
			return true;
		}
	};
}

export const greetingName = createGreetingNameStore();
