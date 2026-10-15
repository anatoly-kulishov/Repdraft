import { CUSTOM_AVATAR_PATH_KEY } from '@repdraft/domain/avatarImage';
import { getSupabase } from './supabase';
import { webOrigin } from '../catalog/mediaUrl';

async function accessToken(): Promise<string> {
	const sb = getSupabase();
	if (!sb) throw new Error('cloud off');
	const {
		data: { session }
	} = await sb.auth.getSession();
	if (!session?.access_token) throw new Error('need auth');
	return session.access_token;
}

export async function signOutEverywhere(): Promise<void> {
	const sb = getSupabase();
	if (!sb) return;
	const { error } = await sb.auth.signOut({ scope: 'global' });
	if (error) throw error;
}

export async function deleteCloudAccount(): Promise<void> {
	const sb = getSupabase();
	if (!sb) throw new Error('cloud off');
	const token = await accessToken();
	const res = await fetch(`${webOrigin()}/api/account/delete`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: 'application/json'
		}
	});
	const body = (await res.json().catch(() => null)) as { error?: string } | null;
	if (!res.ok) {
		throw new Error(body?.error ?? 'auth.deleteFail');
	}
	await sb.auth.signOut();
}

export async function uploadAvatarMultipart(
	userId: string,
	uri: string,
	mime: string,
	ext: 'jpg' | 'webp',
	previousPath: string | null
): Promise<string> {
	const token = await accessToken();
	const form = new FormData();
	form.append('file', {
		uri,
		name: `avatar.${ext}`,
		type: mime
	} as unknown as Blob);
	form.append('ext', ext);
	form.append('contentType', mime);
	if (previousPath) form.append('previousPath', previousPath);

	const res = await fetch(`${webOrigin()}/api/account/avatar`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: 'application/json'
		},
		body: form
	});
	const body = (await res.json().catch(() => null)) as { path?: string; error?: string } | null;
	if (!res.ok || !body?.path) {
		throw new Error(body?.error ?? 'auth.avatar.uploadFail');
	}

	const sb = getSupabase();
	if (!sb) throw new Error('cloud off');
	const { data, error } = await sb.auth.updateUser({
		data: { [CUSTOM_AVATAR_PATH_KEY]: body.path }
	});
	if (error || !data.user) throw error ?? new Error('auth.avatar.uploadFail');
	return body.path;
}

export async function removeAvatarRemote(path: string | null): Promise<void> {
	const sb = getSupabase();
	if (!sb) throw new Error('cloud off');
	const { data, error } = await sb.auth.updateUser({
		data: { [CUSTOM_AVATAR_PATH_KEY]: null }
	});
	if (error || !data.user) throw error ?? new Error('auth.avatar.removeFail');

	if (!path) return;
	const token = await accessToken().catch(() => null);
	if (!token) return;
	await fetch(`${webOrigin()}/api/account/avatar`, {
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
