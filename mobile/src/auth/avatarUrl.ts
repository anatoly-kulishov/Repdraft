import { AVATARS_BUCKET } from '@repdraft/domain/avatarImage';
import { userAvatarUrl, userCustomAvatarPath, type AuthUserLike } from '@repdraft/domain/authFlow';
import type { User } from '@supabase/supabase-js';
import { getSupabase } from './supabase';

function avatarPublicUrl(path: string): string {
	const sb = getSupabase();
	if (!sb || !path.trim()) return '';
	const { data } = sb.storage.from(AVATARS_BUCKET).getPublicUrl(path.trim());
	return data.publicUrl;
}

export function resolveUserAvatarUrl(user: User | null | undefined): string | null {
	const like: AuthUserLike | null = user ?? null;
	const path = userCustomAvatarPath(like);
	const customUrl = path ? avatarPublicUrl(path) : '';
	return userAvatarUrl(like, { customPublicUrl: customUrl || null });
}
