/**
 * Shared design tokens for web + React Native.
 * Edit here, then run `npm run build:tokens` (web CSS) and wire RN via `@repdraft/design/tokens`.
 */

export type AppThemeMode = 'dark' | 'light';

/** Core palette shared across clients. */
export type CoreColorPalette = {
	bg: string;
	/** Primary plate (web `--color-surface`, RN `panel`). */
	panel: string;
	/** Raised / muted plate (web `--color-surface-muted`, RN `panelRaised`). */
	panelRaised: string;
	border: string;
	borderStrong: string;
	text: string;
	muted: string;
	/** Brand violet for chips, focus, icons. */
	accent: string;
	/** Solid CTA fill (web buttons; RN uses `accent` flat fill). */
	accentFill: string;
	/** CTA gradient start (lighter-than-fill endpoint). Together with `accentFill` forms the web CTA gradient. */
	accentGradientStart: string;
	/** CTA gradient start on hover/press (replaces `accentFill`). */
	accentGradientHoverStart: string;
	/** CTA gradient end on hover/press. */
	accentGradientHoverEnd: string;
	/** Label on filled CTA (white). */
	accentInk: string;
	/** Soft accent for links / secondary emphasis (not CTA ink). */
	accentText: string;
	accentDim: string;
	danger: string;
	dangerBg: string;
	overlayScrim: string;
	/** XP bar, streak chip, weight-up cue. */
	xp: string;
	/** Muscles worked today on the hero figure. */
	muscle: string;
};

export const darkColors: CoreColorPalette = {
	bg: '#0E0E11',
	panel: '#1c1c1e',
	panelRaised: '#2c2c2e',
	border: '#3a3a3c',
	borderStrong: '#48484a',
	text: '#ffffff',
	muted: '#8e8e93',
	accent: '#a259ff',
	accentFill: '#a259ff',
	accentGradientStart: '#8a2be2',
	accentGradientHoverStart: '#8a2be2',
	accentGradientHoverEnd: '#a259ff',
	accentInk: '#ffffff',
	accentText: '#c4a3ff',
	accentDim: 'rgba(162, 89, 255, 0.18)',
	danger: '#f87171',
	dangerBg: '#3f1d1d',
	overlayScrim: 'rgba(0, 0, 0, 0.55)',
	xp: '#f5a524',
	muscle: '#3ee0c5'
};

export const lightColors: CoreColorPalette = {
	bg: '#f2f2f7',
	panel: '#ffffff',
	panelRaised: '#e5e5ea',
	border: '#e5e5ea',
	borderStrong: '#d1d1d6',
	text: '#000000',
	muted: '#636366',
	accent: '#8b5cf6',
	accentFill: '#7c3aed',
	accentGradientStart: '#6d28d9',
	accentGradientHoverStart: '#5b21b6',
	accentGradientHoverEnd: '#6d28d9',
	accentInk: '#ffffff',
	accentText: '#5b21b6',
	accentDim: 'rgba(139, 92, 246, 0.12)',
	danger: '#b91c1c',
	dangerBg: '#fef2f2',
	overlayScrim: 'rgba(0, 0, 0, 0.35)',
	xp: '#d97706',
	muscle: '#0f766e'
};

export const touchMin = 48;

export const space = {
	xs: 4,
	sm: 8,
	md: 12,
	lg: 16,
	/** Page horizontal pad - web `--page-pad-x` 1.125rem. */
	page: 18,
	xl: 20,
	xxl: 28
} as const;

/** Floating tab bar - web `--tabbar-h` / `--tabbar-float-gap`. */
export const tabbar = {
	innerH: 58,
	floatGap: 8
} as const;

export const radius = {
	sm: 10,
	md: 16,
	lg: 20,
	xl: 24,
	pill: 999
} as const;

/** Rem values for web CSS generation (px / 16). */
export const radiusRem = {
	/** Cards / panels: 16px. */
	panel: '1rem',
	control: '1rem',
	/** Primary CTAs and main containers: 24px (not pill). */
	button: '1.5rem',
	lg: '1.5rem'
} as const;
