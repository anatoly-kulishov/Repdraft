import gifenc from 'gifenc';
import type {
	EncodeDoneMsg,
	EncodeErrorMsg,
	EncodeProgressMsg,
	EncodeRequest
} from './gifEncode.worker';

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
	/** When container metadata has no duration (MediaRecorder WebM). */
	fallbackDurationSec?: number;
	onProgress?: (p: ConvertProgress) => void;
};

type ConvertPreset = {
	maxDurationSec: number;
	maxWidth: number;
	fps: number;
	colors: number;
	maxFrames: number;
	playCapture: boolean;
	playbackRate: number;
	paletteEvery: number;
};

const DESKTOP: ConvertPreset = {
	maxDurationSec: 6,
	maxWidth: 320,
	fps: 10,
	colors: 160,
	maxFrames: 60,
	playCapture: false,
	playbackRate: 1,
	paletteEvery: 2
};

/** Higher default quality; Worker keeps encode off the UI thread. */
const MOBILE: ConvertPreset = {
	maxDurationSec: 6,
	maxWidth: 280,
	fps: 8,
	colors: 128,
	maxFrames: 48,
	playCapture: true,
	playbackRate: 1.25,
	paletteEvery: 2
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

function yieldToMain(ms = 0): Promise<void> {
	return new Promise((resolve) => {
		requestAnimationFrame(() => {
			if (ms > 0) setTimeout(resolve, ms);
			else setTimeout(resolve, 0);
		});
	});
}

async function loadVideo(
	file: File
): Promise<{ video: HTMLVideoElement; objectUrl: string; duration: number | null }> {
	const objectUrl = URL.createObjectURL(file);
	const video = document.createElement('video');
	video.muted = true;
	video.defaultMuted = true;
	video.playsInline = true;
	video.setAttribute('playsinline', '');
	video.setAttribute('webkit-playsinline', '');
	video.preload = 'auto';
	video.src = objectUrl;

	await new Promise<void>((resolve, reject) => {
		video.onloadedmetadata = () => resolve();
		video.onerror = () => reject(new Error('errors.videoLoad'));
	});

	// MediaRecorder WebM often reports Infinity until we force a seek-to-end.
	if (!Number.isFinite(video.duration) || video.duration <= 0) {
		await new Promise<void>((resolve) => {
			const done = () => {
				video.removeEventListener('durationchange', onMeta);
				video.removeEventListener('timeupdate', onMeta);
				resolve();
			};
			const onMeta = () => {
				if (Number.isFinite(video.duration) && video.duration > 0) done();
			};
			video.addEventListener('durationchange', onMeta);
			video.addEventListener('timeupdate', onMeta);
			try {
				video.currentTime = 1e101;
			} catch {
				done();
				return;
			}
			setTimeout(done, 1200);
		});
		try {
			video.currentTime = 0;
		} catch {
			/* ignore */
		}
	}

	const duration =
		Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null;
	return { video, objectUrl, duration };
}

function seek(video: HTMLVideoElement, time: number): Promise<void> {
	return new Promise((resolve, reject) => {
		const onSeeked = () => {
			video.removeEventListener('seeked', onSeeked);
			resolve();
		};
		video.addEventListener('seeked', onSeeked);
		video.onerror = () => reject(new Error('errors.videoSeek'));
		video.currentTime = Math.min(time, Math.max(0, video.duration - 0.05));
	});
}

function grabFrame(
	ctx: CanvasRenderingContext2D,
	video: HTMLVideoElement,
	width: number,
	height: number
): Uint8ClampedArray {
	ctx.imageSmoothingEnabled = true;
	ctx.imageSmoothingQuality = 'high';
	ctx.drawImage(video, 0, 0, width, height);
	return new Uint8ClampedArray(ctx.getImageData(0, 0, width, height).data);
}

async function captureBySeek(
	video: HTMLVideoElement,
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	duration: number,
	frameCount: number,
	onProgress?: (i: number, total: number) => void
): Promise<Uint8ClampedArray[]> {
	const frames: Uint8ClampedArray[] = [];
	for (let i = 0; i < frameCount; i++) {
		const t = (i / Math.max(1, frameCount - 1)) * Math.max(0, duration - 0.01);
		await seek(video, t);
		frames.push(grabFrame(ctx, video, width, height));
		onProgress?.(i + 1, frameCount);
		await yieldToMain();
	}
	return frames;
}

async function captureByPlayback(
	video: HTMLVideoElement,
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	duration: number,
	frameCount: number,
	playbackRate: number,
	onProgress?: (i: number, total: number) => void
): Promise<Uint8ClampedArray[]> {
	const frames: Uint8ClampedArray[] = [];
	const interval = duration / frameCount;
	let nextAt = 0;

	await seek(video, 0);
	video.playbackRate = playbackRate;

	const hasRvcf =
		typeof (
			video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number }
		).requestVideoFrameCallback === 'function';

	await new Promise<void>((resolve, reject) => {
		let settled = false;
		const finish = () => {
			if (settled) return;
			settled = true;
			video.pause();
			resolve();
		};

		const maybeGrab = () => {
			if (frames.length >= frameCount || video.currentTime >= duration - 0.02) {
				finish();
				return;
			}
			if (video.currentTime + 0.001 >= nextAt) {
				frames.push(grabFrame(ctx, video, width, height));
				onProgress?.(frames.length, frameCount);
				nextAt += interval;
			}
		};

		const onTimeUpdate = () => {
			maybeGrab();
			if (frames.length >= frameCount || video.currentTime >= duration - 0.02) {
				video.removeEventListener('timeupdate', onTimeUpdate);
				finish();
			}
		};

		const onRvfc = () => {
			maybeGrab();
			if (settled) return;
			if (frames.length >= frameCount || video.currentTime >= duration - 0.02) {
				finish();
				return;
			}
			(
				video as HTMLVideoElement & {
					requestVideoFrameCallback: (cb: () => void) => number;
				}
			).requestVideoFrameCallback(onRvfc);
		};

		video.addEventListener('ended', finish, { once: true });
		video.play().then(
			() => {
				if (hasRvcf) {
					(
						video as HTMLVideoElement & {
							requestVideoFrameCallback: (cb: () => void) => number;
						}
					).requestVideoFrameCallback(onRvfc);
				} else {
					video.addEventListener('timeupdate', onTimeUpdate);
				}
			},
			(err) => reject(err instanceof Error ? err : new Error('errors.videoPlay'))
		);

		setTimeout(
			() => {
				if (!settled) finish();
			},
			Math.ceil((duration / playbackRate) * 1000) + 2500
		);
	});

	while (frames.length < frameCount) {
		const i = frames.length;
		const t = (i / Math.max(1, frameCount - 1)) * Math.max(0, duration - 0.01);
		await seek(video, t);
		frames.push(grabFrame(ctx, video, width, height));
		onProgress?.(frames.length, frameCount);
		await yieldToMain(8);
	}

	return frames.slice(0, frameCount);
}

async function encodeOnMainThread(
	frames: Uint8ClampedArray[],
	width: number,
	height: number,
	delayMs: number,
	colors: number,
	paletteEvery: number,
	onProgress?: (i: number, total: number) => void
): Promise<Blob> {
	const refreshEvery = Math.max(1, paletteEvery);
	const gif = GIFEncoder();
	let palette: ReturnType<typeof quantize> | null = null;
	for (let i = 0; i < frames.length; i++) {
		if (!palette || i % refreshEvery === 0) {
			palette = quantize(frames[i]!, colors, { format: 'rgb565' });
		}
		const index = applyPalette(frames[i]!, palette);
		gif.writeFrame(index, width, height, {
			palette,
			delay: delayMs,
			repeat: i === 0 ? 0 : undefined
		});
		onProgress?.(i + 1, frames.length);
		await yieldToMain(i % 2 === 0 ? 16 : 0);
	}
	gif.finish();
	const bytes = gif.bytes();
	return new Blob([bytes.buffer as ArrayBuffer], { type: 'image/gif' });
}

function encodeInWorker(
	frames: Uint8ClampedArray[],
	width: number,
	height: number,
	delayMs: number,
	colors: number,
	paletteEvery: number,
	onProgress?: (i: number, total: number) => void
): Promise<Blob> {
	return new Promise((resolve, reject) => {
		let worker: Worker;
		try {
			worker = new Worker(new URL('./gifEncode.worker.ts', import.meta.url), {
				type: 'module'
			});
		} catch (err) {
			reject(err instanceof Error ? err : new Error('Worker unavailable'));
			return;
		}

		const buffers = frames.map((f) => {
			const copy = f.buffer.slice(f.byteOffset, f.byteOffset + f.byteLength);
			return copy as ArrayBuffer;
		});
		const req: EncodeRequest = {
			frames: buffers,
			width,
			height,
			delayMs,
			colors,
			paletteEvery
		};

		worker.onmessage = (
			event: MessageEvent<EncodeProgressMsg | EncodeDoneMsg | EncodeErrorMsg>
		) => {
			const msg = event.data;
			if (msg.type === 'progress') {
				onProgress?.(msg.index, msg.total);
				return;
			}
			if (msg.type === 'done') {
				worker.terminate();
				resolve(new Blob([msg.bytes], { type: 'image/gif' }));
				return;
			}
			worker.terminate();
			reject(new Error(msg.message));
		};
		worker.onerror = (err) => {
			worker.terminate();
			reject(err.error ?? new Error(err.message || 'Worker failed'));
		};

		worker.postMessage(req, buffers);
	});
}

/**
 * Convert a short technique video into a looping GIF in the browser.
 * Phone: playthrough capture + worker encode so the UI can keep painting.
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

	onProgress?.({ phase: 'load', ratio: 0.05, message: '' });
	await yieldToMain();
	const { video, objectUrl, duration: probed } = await loadVideo(file);
	const rawDuration = probed ?? options.fallbackDurationSec ?? null;
	if (rawDuration == null || rawDuration <= 0) {
		URL.revokeObjectURL(objectUrl);
		throw new Error('errors.videoDuration');
	}

	try {
		const duration = Math.min(rawDuration, maxDurationSec);
		const scale = Math.min(1, maxWidth / (video.videoWidth || maxWidth));
		const width = Math.max(2, Math.round(((video.videoWidth || maxWidth) * scale) / 2) * 2);
		const height = Math.max(2, Math.round(((video.videoHeight || maxWidth) * scale) / 2) * 2);

		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: false });
		if (!ctx) throw new Error('errors.canvas');

		const frameCount = Math.min(preset.maxFrames, Math.max(1, Math.floor(duration * fps)));
		const delayMs = Math.round(1000 / Math.max(1, frameCount / Math.max(duration, 0.1)));

		onProgress?.({ phase: 'frames', ratio: 0.08, message: '' });
		await yieldToMain();

		const onCaptureProgress = (i: number, total: number) => {
			onProgress?.({
				phase: 'frames',
				ratio: 0.08 + 0.42 * (i / total),
				message: ''
			});
		};

		// Seek capture needs a reliable timeline; MediaRecorder blobs often don't.
		const usePlayback = preset.playCapture || probed == null;
		const frames = usePlayback
			? await captureByPlayback(
					video,
					ctx,
					width,
					height,
					duration,
					frameCount,
					preset.playbackRate,
					onCaptureProgress
				)
			: await captureBySeek(video, ctx, width, height, duration, frameCount, onCaptureProgress);

		onProgress?.({ phase: 'encode', ratio: 0.55, message: '' });
		await yieldToMain();

		const onEncodeProgress = (i: number, total: number) => {
			onProgress?.({
				phase: 'encode',
				ratio: 0.55 + 0.4 * (i / total),
				message: `GIF ${i}/${total}`
			});
		};

		let blob: Blob;
		try {
			blob = await encodeInWorker(
				frames,
				width,
				height,
				delayMs,
				colors,
				preset.paletteEvery,
				onEncodeProgress
			);
		} catch {
			blob = await encodeOnMainThread(
				frames,
				width,
				height,
				delayMs,
				colors,
				preset.paletteEvery,
				onEncodeProgress
			);
		}

		onProgress?.({ phase: 'done', ratio: 1, message: '' });
		return blob;
	} finally {
		URL.revokeObjectURL(objectUrl);
	}
}

export const CLIP_LIMITS = {
	maxVideoBytes: 15 * 1024 * 1024,
	maxGifBytes: 8 * 1024 * 1024,
	maxDurationSec: DESKTOP.maxDurationSec,
	accept: 'video/mp4,video/webm,video/quicktime,image/gif,.gif'
} as const;

export function isGifFile(file: File): boolean {
	return file.type === 'image/gif' || /\.gif$/i.test(file.name);
}

export function isVideoFile(file: File): boolean {
	return file.type.startsWith('video/');
}

export function clipEncodeDurationSec(): number {
	return presetForDevice().maxDurationSec;
}

/** Probe duration without keeping the element around. */
export async function readVideoDurationSec(file: File): Promise<number> {
	const { video, objectUrl, duration } = await loadVideo(file);
	try {
		if (duration == null) throw new Error('errors.videoDuration');
		return duration;
	} finally {
		URL.revokeObjectURL(objectUrl);
		video.removeAttribute('src');
		video.load();
	}
}
