import { webApiOrigin } from '$lib/app/native';
import {
	AVATARS_BUCKET,
	CUSTOM_AVATAR_PATH_KEY,
	isValidCustomAvatarPath
} from '$lib/domain/avatarImage';
import { userAvatarUrl, userCustomAvatarPath, type AuthUserLike } from '$lib/domain/authFlow';
import { getSupabase } from '$lib/supabase/client';
import type { User } from '@supabase/supabase-js';

export { AVATAR_CACHE_CONTROL, AVATARS_BUCKET } from '$lib/domain/avatarImage';

/** Map Storage API failures to i18n keys (bucket missing / RLS / generic). */
export function mapAvatarStorageError(err: unknown, fallback: string): Error {
	const code =
		err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
	const statusCode =
		err && typeof err === 'object' && 'statusCode' in err
			? String((err as { statusCode: unknown }).statusCode)
			: '';
	const message =
		err && typeof err === 'object' && 'message' in err
			? String((err as { message: unknown }).message)
			: err instanceof Error
				? err.message
				: '';
	const haystack = `${code} ${statusCode} ${message}`.toLowerCase();
	if (haystack.includes('nosuchbucket') || haystack.includes('bucket not found')) {
		return new Error('auth.avatar.bucketMissing');
	}
	if (
		haystack.includes('row-level security') ||
		haystack.includes('accessdenied') ||
		(haystack.includes('unauthorized') && haystack.includes('403'))
	) {
		return new Error('auth.avatar.storageDenied');
	}
	return new Error(fallback);
}

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

function avatarApiUrl(): string {
	const origin = webApiOrigin();
	return origin ? `${origin}/api/account/avatar` : '/api/account/avatar';
}

async function accessToken(): Promise<string> {
	const supabase = getSupabase();
	if (!supabase) throw new Error('errors.cloudOff');
	const {
		data: { session }
	} = await supabase.auth.getSession();
	if (!session?.access_token) throw new Error('errors.needAuth');
	return session.access_token;
}

/**
 * Compress client-side, then upload via server (service role) so Storage RLS
 * is not required for the first ship. Metadata is updated with the user JWT.
 */
export async function uploadAvatar(
	userId: string,
	blob: Blob,
	contentType: 'image/webp' | 'image/jpeg',
	ext: 'webp' | 'jpg',
	previousPath: string | null
): Promise<UploadAvatarResult> {
	const supabase = getSupabase();
	if (!supabase) throw new Error('errors.cloudOff');

	const token = await accessToken();
	const form = new FormData();
	form.append('file', blob, `avatar.${ext}`);
	form.append('ext', ext);
	form.append('contentType', contentType);
	if (previousPath) form.append('previousPath', previousPath);

	const res = await fetch(avatarApiUrl(), {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: 'application/json'
		},
		body: form
	});
	const body = (await res.json().catch(() => null)) as
		| { path?: string; error?: string }
		| null;
	if (!res.ok || !body?.path) {
		throw new Error(body?.error || 'auth.avatar.uploadFail');
	}
	if (!isValidCustomAvatarPath(body.path, userId)) {
		throw new Error('auth.avatar.uploadFail');
	}

	const { data, error } = await supabase.auth.updateUser({
		data: { [CUSTOM_AVATAR_PATH_KEY]: body.path }
	});
	if (error || !data.user) {
		await fetch(avatarApiUrl(), {
			method: 'DELETE',
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: 'application/json',
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ path: body.path })
		}).catch(() => {
			/* best-effort rollback of orphan object */
		});
		if (error) throw error;
		throw new Error('auth.avatar.uploadFail');
	}

	return { user: data.user, path: body.path };
}

export async function removeAvatar(userId: string, path: string | null): Promise<User> {
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
		const token = await accessToken().catch(() => null);
		if (token) {
			await fetch(avatarApiUrl(), {
				method: 'DELETE',
				headers: {
					Authorization: `Bearer ${token}`,
					Accept: 'application/json',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ path })
			}).catch(() => {
				/* metadata already cleared */
			});
		}
	}

	return data.user;
}
