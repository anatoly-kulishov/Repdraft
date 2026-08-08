import gifenc from 'gifenc';

const { GIFEncoder, quantize, applyPalette } = gifenc;

export type EncodeRequest = {
	frames: ArrayBuffer[];
	width: number;
	height: number;
	delayMs: number;
	colors: number;
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
		const { frames, width, height, delayMs, colors } = event.data;
		if (!frames.length) {
			self.postMessage({
				type: 'error',
				message: 'Нет кадров для GIF'
			});
			return;
		}

		const first = new Uint8ClampedArray(frames[0]!);
		const palette = quantize(first, colors, { format: 'rgb565' });
		const gif = GIFEncoder();
		const total = frames.length;

		for (let i = 0; i < total; i++) {
			const data = new Uint8ClampedArray(frames[i]!);
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
