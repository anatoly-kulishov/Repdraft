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
	/** Label on filled CTA (white). */
	accentInk: string;
	/** Soft accent for links / secondary emphasis (not CTA ink). */
	accentText: string;
	accentDim: string;
	danger: string;
	dangerBg: string;
	overlayScrim: string;
};

export const darkColors: CoreColorPalette = {
	bg: '#0b0b0c',
	panel: '#1c1c1e',
	panelRaised: '#2c2c2e',
	border: '#3a3a3c',
	borderStrong: '#48484a',
	text: '#f5f5f7',
	muted: '#98989d',
	accent: '#8b5cf6',
	accentFill: '#7c3aed',
	accentInk: '#ffffff',
	accentText: '#a78bfa',
	accentDim: 'rgba(139, 92, 246, 0.18)',
	danger: '#f87171',
	dangerBg: '#3f1d1d',
	overlayScrim: 'rgba(0, 0, 0, 0.55)'
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
	accentInk: '#ffffff',
	accentText: '#5b21b6',
	accentDim: 'rgba(139, 92, 246, 0.12)',
	danger: '#b91c1c',
	dangerBg: '#fef2f2',
	overlayScrim: 'rgba(0, 0, 0, 0.35)'
};

export const touchMin = 48;

export const space = {
	xs: 4,
	sm: 8,
	md: 12,
	lg: 16,
	xl: 20,
	xxl: 28
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
	panel: '1.25rem',
	control: '1rem',
	button: '999px',
	lg: '1.25rem'
} as const;
