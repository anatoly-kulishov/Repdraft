/** Client avatar limits (compress before Storage upload). */
export const AVATAR_MAX_PX = 500;
export const AVATAR_MAX_SOURCE_BYTES = 12 * 1024 * 1024;
export const AVATAR_MAX_OUTPUT_BYTES = 300 * 1024;
export const CUSTOM_AVATAR_PATH_KEY = 'custom_avatar_path';

/** Center square crop from a bitmap size. */
export function squareCropRect(
	width: number,
	height: number
): { sx: number; sy: number; size: number } {
	const w = Math.max(0, Math.floor(width));
	const h = Math.max(0, Math.floor(height));
	const size = Math.min(w, h);
	const sx = Math.floor((w - size) / 2);
	const sy = Math.floor((h - size) / 2);
	return { sx, sy, size };
}

/** Output edge length after downscale (never upscales). */
export function avatarOutputSize(sourceSquare: number, maxPx = AVATAR_MAX_PX): number {
	const edge = Math.floor(sourceSquare);
	if (edge <= 0) return 1;
	return Math.min(maxPx, edge);
}

/** Path must be `{userId}/{file}` with webp/jpeg and no traversal. */
export function isValidCustomAvatarPath(path: string, userId: string): boolean {
	const id = userId.trim();
	const value = path.trim();
	if (!id || !value) return false;
	if (value.includes('..') || value.includes('\\')) return false;
	const prefix = `${id}/`;
	if (!value.startsWith(prefix)) return false;
	const name = value.slice(prefix.length);
	if (!name || name.includes('/')) return false;
	return /\.(webp|jpe?g)$/i.test(name);
}

export function runAvatarImageSelfCheck(): void {
	const crop = squareCropRect(800, 600);
	if (crop.size !== 600 || crop.sx !== 100 || crop.sy !== 0) {
		throw new Error('squareCropRect landscape');
	}
	const tall = squareCropRect(400, 900);
	if (tall.size !== 400 || tall.sx !== 0 || tall.sy !== 250) {
		throw new Error('squareCropRect portrait');
	}
	if (avatarOutputSize(800) !== AVATAR_MAX_PX) {
		throw new Error('avatarOutputSize should clamp to max');
	}
	if (avatarOutputSize(200) !== 200) {
		throw new Error('avatarOutputSize should not upscale');
	}
	const uid = '11111111-1111-4111-8111-111111111111';
	if (!isValidCustomAvatarPath(`${uid}/abc.webp`, uid)) {
		throw new Error('valid webp path');
	}
	if (!isValidCustomAvatarPath(`${uid}/abc.jpg`, uid)) {
		throw new Error('valid jpg path');
	}
	if (isValidCustomAvatarPath(`${uid}/../x.webp`, uid)) {
		throw new Error('reject traversal');
	}
	if (isValidCustomAvatarPath(`other/${uid}/x.webp`, uid)) {
		throw new Error('reject other user prefix');
	}
}
