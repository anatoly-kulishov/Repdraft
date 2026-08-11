import { getSupabase } from '$lib/supabase/client';

export async function requireUserId(): Promise<string> {
	const supabase = getSupabase();
	if (!supabase) throw new Error('errors.cloudOff');
	const { data, error } = await supabase.auth.getUser();
	if (error || !data.user) throw new Error('errors.needAuth');
	return data.user.id;
}
