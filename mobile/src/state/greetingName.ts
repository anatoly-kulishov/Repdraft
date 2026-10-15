import AsyncStorage from '@react-native-async-storage/async-storage';
import {
	greetingNameMatchesStored,
	sanitizeGreetingName
} from '@repdraft/domain/greetingName';
import type { User } from '@supabase/supabase-js';
import { getSupabase } from '../auth/supabase';

const LOCAL_KEY = 'repdraft:greeting-name';

function metaGreetingName(user: User | null | undefined): string {
	const raw = user?.user_metadata?.greeting_name;
	if (typeof raw !== 'string') return '';
	return sanitizeGreetingName(raw);
}

/** Local name for guests; cloud metadata when signed in. */
export async function loadGreetingName(user: User | null | undefined): Promise<string> {
	if (user?.id) {
		const fromMeta = metaGreetingName(user);
		if (fromMeta) return fromMeta;
	}
	return sanitizeGreetingName((await AsyncStorage.getItem(LOCAL_KEY)) ?? '');
}

export async function saveGreetingName(
	raw: string,
	user: User | null | undefined
): Promise<boolean> {
	const sanitized = sanitizeGreetingName(raw);
	const current = await loadGreetingName(user);
	if (greetingNameMatchesStored(current, raw)) return false;

	if (user?.id) {
		const sb = getSupabase();
		if (!sb) throw new Error('cloud off');
		const { data, error } = await sb.auth.updateUser({
			data: { greeting_name: sanitized || null }
		});
		if (error) throw error;
		const next = metaGreetingName(data.user) || sanitized;
		await AsyncStorage.setItem(LOCAL_KEY, next);
		return true;
	}

	await AsyncStorage.setItem(LOCAL_KEY, sanitized);
	return true;
}
