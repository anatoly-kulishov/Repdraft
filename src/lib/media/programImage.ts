/** Compress a program photo before Pro recognize upload (long edge ~2000px, JPEG). */

const PROGRAM_MAX_EDGE = 2000;
const PROGRAM_MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const PROGRAM_MAX_OUTPUT_BYTES = 8 * 1024 * 1024;

export type CompressedProgramImage = {
	blob: Blob;
	contentType: 'image/jpeg';
	filename: string;
};

function canvasToBlob(
	canvas: HTMLCanvasElement,
	type: 'image/jpeg',
	quality: number
): Promise<Blob | null> {
	return new Promise((resolve) => {
		canvas.toBlob((blob) => resolve(blob), type, quality);
	});
}

/**
 * Downscale long edge to PROGRAM_MAX_EDGE and encode JPEG.
 * Non-image files should not call this (xlsx/csv pass through as-is).
 */
export async function compressProgramImage(file: File): Promise<CompressedProgramImage> {
	if (!file || file.size <= 0) throw new Error('recognize.invalidFile');
	if (file.size > PROGRAM_MAX_SOURCE_BYTES) throw new Error('recognize.tooLarge');

	let bitmap: ImageBitmap;
	try {
		bitmap = await createImageBitmap(file);
	} catch {
		throw new Error('recognize.invalidFile');
	}

	try {
		const long = Math.max(bitmap.width, bitmap.height);
		const scale = long > PROGRAM_MAX_EDGE ? PROGRAM_MAX_EDGE / long : 1;
		const w = Math.max(1, Math.round(bitmap.width * scale));
		const h = Math.max(1, Math.round(bitmap.height * scale));
		const canvas = document.createElement('canvas');
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('recognize.compressFail');
		ctx.drawImage(bitmap, 0, 0, w, h);

		let quality = 0.85;
		let jpeg = await canvasToBlob(canvas, 'image/jpeg', quality);
		while (jpeg && jpeg.size > PROGRAM_MAX_OUTPUT_BYTES && quality > 0.45) {
			quality -= 0.1;
			jpeg = await canvasToBlob(canvas, 'image/jpeg', quality);
		}
		if (!jpeg || jpeg.size <= 0) throw new Error('recognize.compressFail');
		if (jpeg.size > PROGRAM_MAX_OUTPUT_BYTES) throw new Error('recognize.tooLarge');

		const base = (file.name || 'program').replace(/\.[^.]+$/, '') || 'program';
		return { blob: jpeg, contentType: 'image/jpeg', filename: `${base}.jpg` };
	} finally {
		bitmap.close();
	}
}
