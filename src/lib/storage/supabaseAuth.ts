import { getSupabase } from '$lib/supabase/client';
import { isRevokedSessionError } from '$lib/stores/sessionRevoked';
import { reportRevokedSession } from '$lib/stores/sessionRevoked';

/**
 * Current signed-in user id, or throw when the account is gone.
 *
 * Every cloud write funnels through here (sessions / records / workouts), so a
 * provably-dead identity — invalid JWT, revoked refresh, account signed out on
 * the server — is escalated to a real logout instead of surfacing as nothing
 * but a sync-error toast. Transient network/auth failures stay silent here so
 * we never bounce an online user to guest on a blip.
 */
export async function requireUserId(): Promise<string> {
	const supabase = getSupabase();
	if (!supabase) throw new Error('errors.cloudOff');
	const { data, error } = await supabase.auth.getUser();
	if (error || !data.user) {
		if (isRevokedSessionError(error)) reportRevokedSession();
		throw new Error('errors.needAuth');
	}
	return data.user.id;
}
