import {
	AVATAR_MAX_OUTPUT_BYTES,
	AVATAR_MAX_PX,
	AVATAR_MAX_SOURCE_BYTES,
	avatarOutputSize,
	squareCropRect
} from '$lib/domain/avatarImage';

export type CompressedAvatar = {
	blob: Blob;
	contentType: 'image/webp' | 'image/jpeg';
	ext: 'webp' | 'jpg';
};

function assertImageFile(file: File): void {
	if (!file || file.size <= 0) throw new Error('auth.avatar.notImage');
	if (file.size > AVATAR_MAX_SOURCE_BYTES) throw new Error('auth.avatar.tooLarge');
	const type = (file.type || '').toLowerCase();
	if (type && !type.startsWith('image/')) throw new Error('auth.avatar.notImage');
}

function loadImageBitmap(file: File): Promise<ImageBitmap> {
	return createImageBitmap(file);
}

function canvasToBlob(
	canvas: HTMLCanvasElement,
	type: 'image/webp' | 'image/jpeg',
	quality: number
): Promise<Blob | null> {
	return new Promise((resolve) => {
		canvas.toBlob((blob) => resolve(blob), type, quality);
	});
}

/**
 * Center-crop to square, downscale to max 500px, encode WebP then JPEG.
 * Throws Error with i18n message keys on validation / encode failure.
 */
export async function compressAvatarImage(file: File): Promise<CompressedAvatar> {
	assertImageFile(file);

	let bitmap: ImageBitmap;
	try {
		bitmap = await loadImageBitmap(file);
	} catch {
		throw new Error('auth.avatar.notImage');
	}

	try {
		const { sx, sy, size } = squareCropRect(bitmap.width, bitmap.height);
		if (size <= 0) throw new Error('auth.avatar.notImage');

		const out = avatarOutputSize(size, AVATAR_MAX_PX);
		const canvas = document.createElement('canvas');
		canvas.width = out;
		canvas.height = out;
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('auth.avatar.compressFail');

		ctx.drawImage(bitmap, sx, sy, size, size, 0, 0, out, out);

		const webp = await canvasToBlob(canvas, 'image/webp', 0.82);
		if (webp && webp.size > 0 && webp.size <= AVATAR_MAX_OUTPUT_BYTES && webp.type === 'image/webp') {
			return { blob: webp, contentType: 'image/webp', ext: 'webp' };
		}

		const jpeg = await canvasToBlob(canvas, 'image/jpeg', 0.85);
		if (!jpeg || jpeg.size <= 0) throw new Error('auth.avatar.compressFail');
		if (jpeg.size > AVATAR_MAX_OUTPUT_BYTES) throw new Error('auth.avatar.tooLarge');
		return { blob: jpeg, contentType: 'image/jpeg', ext: 'jpg' };
	} finally {
		bitmap.close();
	}
}
