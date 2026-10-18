/** Color tokens aligned with web `tokens.css` dark / light. */
export type ColorPalette = {
	bg: string;
	panel: string;
	panelRaised: string;
	border: string;
	borderStrong: string;
	text: string;
	muted: string;
	accent: string;
	accentText: string;
	accentDim: string;
	danger: string;
	dangerBg: string;
	/** Modal/sheet scrim */
	overlayScrim: string;
};

export const darkPalette: ColorPalette = {
	bg: '#0b0b0c',
	panel: '#1c1c1e',
	panelRaised: '#2c2c2e',
	border: '#3a3a3c',
	borderStrong: '#48484a',
	text: '#f5f5f7',
	muted: '#98989d',
	accent: '#8b5cf6',
	accentText: '#ffffff',
	accentDim: 'rgba(139, 92, 246, 0.18)',
	danger: '#f87171',
	dangerBg: '#3f1d1d',
	overlayScrim: 'rgba(0,0,0,0.55)'
};

export const lightPalette: ColorPalette = {
	bg: '#f2f2f7',
	panel: '#ffffff',
	panelRaised: '#ffffff',
	border: '#d1d1d6',
	borderStrong: '#c7c7cc',
	text: '#000000',
	muted: '#636366',
	accent: '#8b5cf6',
	accentText: '#ffffff',
	accentDim: 'rgba(139, 92, 246, 0.12)',
	danger: '#dc2626',
	dangerBg: '#fef2f2',
	overlayScrim: 'rgba(0,0,0,0.35)'
};

export type AppThemeMode = 'dark' | 'light';
