import {
	darkColors,
	lightColors,
	type AppThemeMode,
	type CoreColorPalette
} from '@repdraft/design/tokens';

/**
 * RN screen palette - names match web tokens.
 * Soft accent text/icons: `accentText` / `accentLink`.
 * Label on filled CTA: `accentInk` only.
 */
export type ColorPalette = {
	bg: string;
	panel: string;
	panelRaised: string;
	border: string;
	borderStrong: string;
	/** Glassmorphism card edge - subtle contour. */
	borderGlass: string;
	text: string;
	muted: string;
	accent: string;
	accentFill: string;
	accentGradientStart: string;
	accentGradientHoverStart: string;
	accentGradientHoverEnd: string;
	/** White (or on-fill) label on primary CTA. */
	accentInk: string;
	/** Soft accent for chips, tabs, links (web `--color-accent-text`). */
	accentText: string;
	/** Alias of accentText for link emphasis. */
	accentLink: string;
	accentDim: string;
	danger: string;
	dangerBg: string;
	/** Modal/sheet scrim */
	overlayScrim: string;
	xp: string;
	muscle: string;
	/** Hairline list dividers inside panels. */
	divider: string;
};

function toRnPalette(c: CoreColorPalette, dark: boolean): ColorPalette {
	return {
		bg: c.bg,
		panel: c.panel,
		panelRaised: c.panelRaised,
		border: c.border,
		borderStrong: c.borderStrong,
		borderGlass: dark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
		text: c.text,
		muted: c.muted,
		accent: c.accent,
		accentFill: c.accentFill,
		accentGradientStart: c.accentGradientStart,
		accentGradientHoverStart: c.accentGradientHoverStart,
		accentGradientHoverEnd: c.accentGradientHoverEnd,
		accentInk: c.accentInk,
		accentText: c.accentText,
		accentLink: c.accentText,
		accentDim: c.accentDim,
		danger: c.danger,
		dangerBg: c.dangerBg,
		overlayScrim: c.overlayScrim,
		xp: c.xp,
		muscle: c.muscle,
		divider: dark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(0, 0, 0, 0.08)'
	};
}

export const darkPalette: ColorPalette = toRnPalette(darkColors, true);
export const lightPalette: ColorPalette = toRnPalette(lightColors, false);

export type { AppThemeMode };
