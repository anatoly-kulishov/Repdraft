import {
	AVATAR_CACHE_CONTROL,
	AVATAR_MAX_OUTPUT_BYTES,
	AVATARS_BUCKET,
	isValidCustomAvatarPath
} from '$lib/domain/avatarImage';
import { newId } from '$lib/domain/id';
import { accountCorsHeaders, requireUser } from '$lib/server/auth/requireUser';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function corsHeaders(request: Request): HeadersInit {
	return accountCorsHeaders(request, 'POST, DELETE, OPTIONS');
}

function jsonWithCors(request: Request, body: unknown, init?: ResponseInit) {
	const headers = new Headers(init?.headers);
	const cors = corsHeaders(request);
	for (const [k, v] of Object.entries(cors)) headers.set(k, v);
	return json(body, { ...init, headers });
}

export const OPTIONS: RequestHandler = async ({ request }) =>
	new Response(null, { status: 204, headers: corsHeaders(request) });

/** Upload avatar object under `{userId}/{id}.{ext}` (service role bypasses Storage RLS). */
export const POST: RequestHandler = async ({ request }) => {
	const gate = await requireUser(request);
	if (!gate.ok) {
		const errorKey = gate.status === 503 ? 'auth.avatar.uploadFail' : gate.errorKey;
		return jsonWithCors(request, { error: errorKey }, { status: gate.status });
	}
	const { user, admin } = gate;

	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return jsonWithCors(request, { error: 'auth.avatar.notImage' }, { status: 400 });
	}

	const file = form.get('file');
	const extRaw = String(form.get('ext') ?? '').toLowerCase();
	const contentTypeRaw = String(form.get('contentType') ?? '').toLowerCase();
	const previousPathRaw = form.get('previousPath');
	const previousPath =
		typeof previousPathRaw === 'string' && previousPathRaw.trim() ? previousPathRaw.trim() : null;

	const ext = extRaw === 'webp' || extRaw === 'jpg' ? extRaw : null;
	const contentType =
		contentTypeRaw === 'image/webp' || contentTypeRaw === 'image/jpeg' ? contentTypeRaw : null;
	if (!(file instanceof Blob) || file.size <= 0 || !ext || !contentType) {
		return jsonWithCors(request, { error: 'auth.avatar.notImage' }, { status: 400 });
	}
	if (file.size > AVATAR_MAX_OUTPUT_BYTES) {
		return jsonWithCors(request, { error: 'auth.avatar.tooLarge' }, { status: 400 });
	}

	const path = `${user.id}/${newId()}.${ext}`;
	if (!isValidCustomAvatarPath(path, user.id)) {
		return jsonWithCors(request, { error: 'auth.avatar.uploadFail' }, { status: 500 });
	}

	const { error: uploadError } = await admin.storage.from(AVATARS_BUCKET).upload(path, file, {
		contentType,
		cacheControl: AVATAR_CACHE_CONTROL,
		upsert: false
	});
	if (uploadError) {
		console.error('avatar upload', uploadError);
		return jsonWithCors(request, { error: 'auth.avatar.uploadFail' }, { status: 500 });
	}

	if (previousPath && previousPath !== path && isValidCustomAvatarPath(previousPath, user.id)) {
		await admin.storage.from(AVATARS_BUCKET).remove([previousPath]).catch(() => {
			/* best-effort */
		});
	}

	return jsonWithCors(request, { path });
};

/** Delete an avatar object owned by the signed-in user. */
export const DELETE: RequestHandler = async ({ request }) => {
	const gate = await requireUser(request);
	if (!gate.ok) {
		return jsonWithCors(request, { error: gate.errorKey }, { status: gate.status });
	}
	const { user, admin } = gate;

	let path: string | null = null;
	try {
		const body = (await request.json()) as { path?: unknown };
		if (typeof body.path === 'string' && body.path.trim()) path = body.path.trim();
	} catch {
		return jsonWithCors(request, { error: 'auth.avatar.removeFail' }, { status: 400 });
	}

	if (!path || !isValidCustomAvatarPath(path, user.id)) {
		return jsonWithCors(request, { error: 'auth.avatar.removeFail' }, { status: 400 });
	}

	const { error } = await admin.storage.from(AVATARS_BUCKET).remove([path]);
	if (error) {
		console.error('avatar remove', error);
		return jsonWithCors(request, { error: 'auth.avatar.removeFail' }, { status: 500 });
	}

	return jsonWithCors(request, { ok: true });
};
