import {
	CUSTOM_AVATAR_PATH_KEY,
	isValidCustomAvatarPath
} from '$lib/domain/avatarImage';
import { userAvatarUrl, userCustomAvatarPath, type AuthUserLike } from '$lib/domain/authFlow';
import { newId } from '$lib/domain/id';
import { getSupabase } from '$lib/supabase/client';
import type { User } from '@supabase/supabase-js';

export const AVATARS_BUCKET = 'avatars';
/** Short cache: path changes on each upload, but browsers may still hold the old object URL briefly. */
export const AVATAR_CACHE_CONTROL = '3600';

export function avatarPublicUrl(path: string): string {
	const supabase = getSupabase();
	if (!supabase || !path.trim()) return '';
	const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path.trim());
	return data.publicUrl;
}

/** Custom Storage URL first, then OAuth provider photo. */
export function resolveUserAvatarUrl(user: AuthUserLike | null | undefined): string | null {
	const path = userCustomAvatarPath(user);
	const customUrl = path ? avatarPublicUrl(path) : '';
	return userAvatarUrl(user, { customPublicUrl: customUrl || null });
}

export type UploadAvatarResult = {
	user: User;
	path: string;
};

export async function uploadAvatar(
	userId: string,
	blob: Blob,
	contentType: 'image/webp' | 'image/jpeg',
	ext: 'webp' | 'jpg',
	previousPath: string | null
): Promise<UploadAvatarResult> {
	const supabase = getSupabase();
	if (!supabase) throw new Error('errors.cloudOff');

	const path = `${userId}/${newId()}.${ext}`;
	if (!isValidCustomAvatarPath(path, userId)) {
		throw new Error('auth.avatar.uploadFail');
	}

	const { error: uploadError } = await supabase.storage.from(AVATARS_BUCKET).upload(path, blob, {
		contentType,
		cacheControl: AVATAR_CACHE_CONTROL,
		upsert: false
	});
	if (uploadError) throw uploadError;

	const { data, error } = await supabase.auth.updateUser({
		data: { [CUSTOM_AVATAR_PATH_KEY]: path }
	});
	if (error || !data.user) {
		await supabase.storage.from(AVATARS_BUCKET).remove([path]);
		if (error) throw error;
		throw new Error('auth.avatar.uploadFail');
	}

	if (previousPath && previousPath !== path && isValidCustomAvatarPath(previousPath, userId)) {
		await supabase.storage.from(AVATARS_BUCKET).remove([previousPath]).catch(() => {
			/* best-effort orphan cleanup */
		});
	}

	return { user: data.user, path };
}

export async function removeAvatar(
	userId: string,
	path: string | null
): Promise<User> {
	const supabase = getSupabase();
	if (!supabase) throw new Error('errors.cloudOff');

	const { data, error } = await supabase.auth.updateUser({
		data: { [CUSTOM_AVATAR_PATH_KEY]: null }
	});
	if (error || !data.user) {
		if (error) throw error;
		throw new Error('auth.avatar.removeFail');
	}

	if (path && isValidCustomAvatarPath(path, userId)) {
		await supabase.storage.from(AVATARS_BUCKET).remove([path]).catch(() => {
			/* metadata already cleared */
		});
	}

	return data.user;
}
