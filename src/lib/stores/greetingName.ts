import { browser } from '$app/environment';
import { sanitizeGreetingName } from '$lib/domain/greetingName';
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
			set(metaGreetingName(user) ?? '');
		},
		async save(raw: string, userId: string): Promise<void> {
			if (!browser || !userId) return;
			const sanitized = sanitizeGreetingName(raw);
			const supabase = getSupabase();
			if (!supabase) throw new Error('errors.cloudOff');
			const { data, error } = await supabase.auth.updateUser({
				data: { greeting_name: sanitized || null }
			});
			if (error) throw error;
			set(metaGreetingName(data.user) ?? sanitized);
		}
	};
}

export const greetingName = createGreetingNameStore();
