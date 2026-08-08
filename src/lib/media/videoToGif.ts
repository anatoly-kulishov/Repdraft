import gifenc from 'gifenc';

const { GIFEncoder, quantize, applyPalette } = gifenc;

export type ConvertProgress = {
	phase: 'load' | 'frames' | 'encode' | 'done';
	ratio: number;
	message: string;
};

export type ConvertOptions = {
	maxDurationSec?: number;
	maxWidth?: number;
	fps?: number;
	colors?: number;
	onProgress?: (p: ConvertProgress) => void;
};

type ConvertPreset = {
	maxDurationSec: number;
	maxWidth: number;
	fps: number;
	colors: number;
	/** Re-quantize every N frames; reuse palette between (big mobile win). */
	paletteEvery: number;
};

const DESKTOP: ConvertPreset = {
	maxDurationSec: 6,
	maxWidth: 240,
	fps: 8,
	colors: 96,
	paletteEvery: 4
};

const MOBILE: ConvertPreset = {
	maxDurationSec: 4,
	maxWidth: 160,
	fps: 5,
	colors: 64,
	paletteEvery: 6
};

function isLikelyPhone(): boolean {
	if (typeof navigator === 'undefined') return false;
	const coarse = window.matchMedia?.('(pointer: coarse)').matches;
	const narrow = window.matchMedia?.('(max-width: 720px)').matches;
	const touch = navigator.maxTouchPoints > 1;
	return Boolean(coarse || (touch && narrow));
}

function presetForDevice(): ConvertPreset {
	return isLikelyPhone() ? MOBILE : DESKTOP;
}

/** Let the browser paint / handle input between heavy frames. */
function yieldToMain(): Promise<void> {
	return new Promise((resolve) => {
		requestAnimationFrame(() => {
			setTimeout(resolve, 0);
		});
	});
}

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
 * Phone: smaller size / fewer frames / reused palette so UI stays responsive.
 */
export async function videoFileToGif(
	file: File,
	options: ConvertOptions = {}
): Promise<Blob> {
	const preset = presetForDevice();
	const maxDurationSec = options.maxDurationSec ?? preset.maxDurationSec;
	const maxWidth = options.maxWidth ?? preset.maxWidth;
	const fps = options.fps ?? preset.fps;
	const colors = options.colors ?? preset.colors;
	const onProgress = options.onProgress;

	onProgress?.({ phase: 'load', ratio: 0.05, message: 'Читаем видео…' });
	await yieldToMain();
	const { video, objectUrl } = await loadVideo(file);

	try {
		const duration = Math.min(video.duration, maxDurationSec);
		const scale = Math.min(1, maxWidth / (video.videoWidth || maxWidth));
		const width = Math.max(2, Math.round(((video.videoWidth || maxWidth) * scale) / 2) * 2);
		const height = Math.max(2, Math.round(((video.videoHeight || maxWidth) * scale) / 2) * 2);

		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: false });
		if (!ctx) throw new Error('Canvas недоступен');

		const frameCount = Math.max(1, Math.floor(duration * fps));
		const delayMs = Math.round(1000 / fps);
		const gif = GIFEncoder();

		onProgress?.({ phase: 'frames', ratio: 0.1, message: `Кадры 0/${frameCount}` });
		await yieldToMain();

		let palette: ReturnType<typeof quantize> | null = null;

		for (let i = 0; i < frameCount; i++) {
			const t = (i / Math.max(1, frameCount - 1)) * Math.max(0, duration - 0.01);
			await seek(video, t);
			ctx.drawImage(video, 0, 0, width, height);
			const { data } = ctx.getImageData(0, 0, width, height);

			if (!palette || i % preset.paletteEvery === 0) {
				palette = quantize(data, colors, { format: 'rgb565' });
			}

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
			await yieldToMain();
		}

		onProgress?.({ phase: 'encode', ratio: 0.92, message: 'Собираем GIF…' });
		await yieldToMain();
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
	/** Desktop cap; phone encodes a shorter head (see presetForDevice). */
	maxDurationSec: DESKTOP.maxDurationSec,
	accept: 'video/mp4,video/webm,video/quicktime'
} as const;

/** Duration hint for UI copy (matches encode preset). */
export function clipEncodeDurationSec(): number {
	return presetForDevice().maxDurationSec;
}
