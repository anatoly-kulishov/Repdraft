import gifenc from 'gifenc';

const { GIFEncoder, quantize, applyPalette } = gifenc;

export type EncodeRequest = {
	frames: ArrayBuffer[];
	width: number;
	height: number;
	delayMs: number;
	colors: number;
	/** Recompute palette every N frames (1 = every frame). */
	paletteEvery: number;
};

export type EncodeProgressMsg = { type: 'progress'; ratio: number; index: number; total: number };
export type EncodeDoneMsg = { type: 'done'; bytes: ArrayBuffer };
export type EncodeErrorMsg = { type: 'error'; message: string };

declare const self: {
	onmessage: ((event: MessageEvent<EncodeRequest>) => void) | null;
	postMessage: (message: EncodeProgressMsg | EncodeDoneMsg | EncodeErrorMsg, transfer?: Transferable[]) => void;
};

self.onmessage = (event: MessageEvent<EncodeRequest>) => {
	try {
		const { frames, width, height, delayMs, colors, paletteEvery } = event.data;
		if (!frames.length) {
			self.postMessage({
				type: 'error',
				message: 'Нет кадров для GIF'
			});
			return;
		}

		const refreshEvery = Math.max(1, paletteEvery || 1);
		const gif = GIFEncoder();
		const total = frames.length;
		let palette: ReturnType<typeof quantize> | null = null;

		for (let i = 0; i < total; i++) {
			const data = new Uint8ClampedArray(frames[i]!);
			if (!palette || i % refreshEvery === 0) {
				palette = quantize(data, colors, { format: 'rgb565' });
			}
			const index = applyPalette(data, palette);
			gif.writeFrame(index, width, height, {
				palette,
				delay: delayMs,
				repeat: i === 0 ? 0 : undefined
			});
			self.postMessage({
				type: 'progress',
				ratio: (i + 1) / total,
				index: i + 1,
				total
			});
		}

		gif.finish();
		const bytes = gif.bytes();
		const out = bytes.buffer.slice(
			bytes.byteOffset,
			bytes.byteOffset + bytes.byteLength
		) as ArrayBuffer;
		self.postMessage({ type: 'done', bytes: out }, [out]);
	} catch (err) {
		self.postMessage({
			type: 'error',
			message: err instanceof Error ? err.message : 'GIF encode failed'
		});
	}
};
