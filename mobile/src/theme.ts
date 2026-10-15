import { darkPalette } from './theme/palettes';

/** @deprecated Prefer `useAppColors()` inside screens; static fallback for legacy StyleSheets. */
export const colors = darkPalette;

export { darkPalette, lightPalette } from './theme/palettes';
export type { AppThemeMode, ColorPalette } from './theme/palettes';

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
	md: 14,
	lg: 18,
	xl: 22
} as const;

export const type = {
	lead: { fontSize: 15, lineHeight: 22, fontWeight: '500' as const },
	title: { fontSize: 22, lineHeight: 28, fontWeight: '800' as const },
	section: { fontSize: 13, lineHeight: 18, fontWeight: '700' as const, letterSpacing: 0.4 },
	body: { fontSize: 16, lineHeight: 22, fontWeight: '600' as const },
	meta: { fontSize: 13, lineHeight: 18, fontWeight: '500' as const }
};
