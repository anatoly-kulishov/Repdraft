import { GIFEncoder, quantize, applyPalette } from 'gifenc';

export type ConvertProgress = {
	phase: 'load' | 'frames' | 'encode' | 'done';
	ratio: number;
	message: string;
};

export type ConvertOptions = {
	maxDurationSec?: number;
	maxWidth?: number;
	fps?: number;
	onProgress?: (p: ConvertProgress) => void;
};

const DEFAULTS = {
	maxDurationSec: 6,
	maxWidth: 240,
	fps: 8
};

async function loadVideo(file: File): Promise<{ video: HTMLVideoElement; objectUrl: string }> {
	const objectUrl = URL.createObjectURL(file);
	const video = document.createElement('video');
	video.muted = true;
	video.playsInline = true;
	video.preload = 'auto';
	video.src = objectUrl;

	await new Promise<void>((resolve, reject) => {
		video.onloadedmetadata = () => {
			if (!Number.isFinite(video.duration) || video.duration <= 0) {
				reject(new Error('Не удалось прочитать длительность видео'));
				return;
			}
			resolve();
		};
		video.onerror = () => reject(new Error('Не удалось загрузить видео'));
	});

	return { video, objectUrl };
}

function seek(video: HTMLVideoElement, time: number): Promise<void> {
	return new Promise((resolve, reject) => {
		const onSeeked = () => {
			video.removeEventListener('seeked', onSeeked);
			resolve();
		};
		video.addEventListener('seeked', onSeeked);
		video.onerror = () => reject(new Error('Ошибка перемотки видео'));
		video.currentTime = Math.min(time, Math.max(0, video.duration - 0.05));
	});
}

/**
 * Convert a short technique video into a looping GIF in the browser.
 * Keeps output small: short duration, reduced width, limited FPS.
 */
export async function videoFileToGif(
	file: File,
	options: ConvertOptions = {}
): Promise<Blob> {
	const maxDurationSec = options.maxDurationSec ?? DEFAULTS.maxDurationSec;
	const maxWidth = options.maxWidth ?? DEFAULTS.maxWidth;
	const fps = options.fps ?? DEFAULTS.fps;
	const onProgress = options.onProgress;

	onProgress?.({ phase: 'load', ratio: 0.05, message: 'Читаем видео…' });
	const { video, objectUrl } = await loadVideo(file);

	try {
		const duration = Math.min(video.duration, maxDurationSec);
		const scale = Math.min(1, maxWidth / (video.videoWidth || maxWidth));
		const width = Math.max(2, Math.round(((video.videoWidth || maxWidth) * scale) / 2) * 2);
		const height = Math.max(2, Math.round(((video.videoHeight || maxWidth) * scale) / 2) * 2);

		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext('2d', { willReadFrequently: true });
		if (!ctx) throw new Error('Canvas недоступен');

		const frameCount = Math.max(1, Math.floor(duration * fps));
		const delayMs = Math.round(1000 / fps);
		const gif = GIFEncoder();

		onProgress?.({ phase: 'frames', ratio: 0.1, message: `Кадры 0/${frameCount}` });

		for (let i = 0; i < frameCount; i++) {
			const t = (i / Math.max(1, frameCount - 1)) * Math.max(0, duration - 0.01);
			await seek(video, t);
			ctx.drawImage(video, 0, 0, width, height);
			const { data } = ctx.getImageData(0, 0, width, height);
			const palette = quantize(data, 128, { format: 'rgb565' });
			const index = applyPalette(data, palette);
			gif.writeFrame(index, width, height, {
				palette,
				delay: delayMs,
				repeat: i === 0 ? 0 : undefined
			});
			onProgress?.({
				phase: 'frames',
				ratio: 0.1 + (0.75 * (i + 1)) / frameCount,
				message: `Кадры ${i + 1}/${frameCount}`
			});
		}

		onProgress?.({ phase: 'encode', ratio: 0.92, message: 'Собираем GIF…' });
		gif.finish();
		const bytes = gif.bytes();
		onProgress?.({ phase: 'done', ratio: 1, message: 'Готово' });
		return new Blob([bytes.buffer as ArrayBuffer], { type: 'image/gif' });
	} finally {
		URL.revokeObjectURL(objectUrl);
	}
}

export const CLIP_LIMITS = {
	maxVideoBytes: 15 * 1024 * 1024,
	maxDurationSec: DEFAULTS.maxDurationSec,
	accept: 'video/mp4,video/webm,video/quicktime'
} as const;
