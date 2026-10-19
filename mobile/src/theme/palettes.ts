import {
	darkColors,
	lightColors,
	type AppThemeMode,
	type CoreColorPalette
} from '@repdraft/design/tokens';

/**
 * RN screen palette.
 * `accentText` is CTA ink (white on filled buttons) = shared `accentInk`.
 * Soft link accent is `accentLink` (= shared `accentText`).
 */
export type ColorPalette = {
	bg: string;
	panel: string;
	panelRaised: string;
	border: string;
	borderStrong: string;
	text: string;
	muted: string;
	accent: string;
	accentFill: string;
	/** White (or on-fill) label on primary CTA. */
	accentInk: string;
	/** @deprecated Use accentInk for CTA ink; kept for compat. */
	accentText: string;
	/** Soft accent for links / secondary emphasis. */
	accentLink: string;
	accentDim: string;
	danger: string;
	dangerBg: string;
	/** Modal/sheet scrim */
	overlayScrim: string;
	xp: string;
	muscle: string;
};

function toRnPalette(c: CoreColorPalette): ColorPalette {
	return {
		bg: c.bg,
		panel: c.panel,
		panelRaised: c.panelRaised,
		border: c.border,
		borderStrong: c.borderStrong,
		text: c.text,
		muted: c.muted,
		accent: c.accent,
		accentFill: c.accentFill,
		accentInk: c.accentInk,
		accentText: c.accentInk,
		accentLink: c.accentText,
		accentDim: c.accentDim,
		danger: c.danger,
		dangerBg: c.dangerBg,
		overlayScrim: c.overlayScrim,
		xp: c.xp,
		muscle: c.muscle
	};
}

export const darkPalette: ColorPalette = toRnPalette(darkColors);
export const lightPalette: ColorPalette = toRnPalette(lightColors);

export type { AppThemeMode };
