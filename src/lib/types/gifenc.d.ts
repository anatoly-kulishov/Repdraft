declare module 'gifenc' {
	export function quantize(
		rgba: Uint8Array | Uint8ClampedArray,
		maxColors: number,
		options?: { format?: string }
	): number[][];

	export function applyPalette(
		rgba: Uint8Array | Uint8ClampedArray,
		palette: number[][],
		format?: string
	): Uint8Array;

	export function GIFEncoder(options?: { auto?: boolean }): {
		writeFrame: (
			index: Uint8Array,
			width: number,
			height: number,
			opts?: { palette?: number[][]; delay?: number; repeat?: number }
		) => void;
		finish: () => void;
		bytes: () => Uint8Array;
	};
}
