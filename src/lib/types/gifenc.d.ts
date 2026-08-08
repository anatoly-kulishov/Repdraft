declare module 'gifenc' {
	type GifEncoderInstance = {
		writeFrame: (
			index: Uint8Array,
			width: number,
			height: number,
			opts?: { palette?: number[][]; delay?: number; repeat?: number }
		) => void;
		finish: () => void;
		bytes: () => Uint8Array;
	};

	type GifencApi = {
		quantize: (
			rgba: Uint8Array | Uint8ClampedArray,
			maxColors: number,
			options?: { format?: string }
		) => number[][];
		applyPalette: (
			rgba: Uint8Array | Uint8ClampedArray,
			palette: number[][],
			format?: string
		) => Uint8Array;
		GIFEncoder: (options?: { auto?: boolean }) => GifEncoderInstance;
	};

	const gifenc: GifencApi;
	export default gifenc;
}
