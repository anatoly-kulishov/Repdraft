import { radius as sharedRadius, space as sharedSpace, touchMin as sharedTouchMin } from '@repdraft/design/tokens';
import { darkPalette } from './theme/palettes';

/** @deprecated Prefer `useAppColors()` inside screens; static fallback for legacy StyleSheets. */
export const colors = darkPalette;

export { darkPalette, lightPalette } from './theme/palettes';
export type { AppThemeMode, ColorPalette } from './theme/palettes';

export const touchMin = sharedTouchMin;

export const space = sharedSpace;

export const radius = sharedRadius;

export const type = {
	lead: { fontSize: 15, lineHeight: 22, fontWeight: '500' as const },
	title: { fontSize: 28, lineHeight: 34, fontWeight: '800' as const },
	header: { fontSize: 17, lineHeight: 22, fontWeight: '700' as const },
	section: { fontSize: 13, lineHeight: 18, fontWeight: '700' as const, letterSpacing: 0.4 },
	body: { fontSize: 17, lineHeight: 22, fontWeight: '600' as const },
	meta: { fontSize: 13, lineHeight: 18, fontWeight: '500' as const }
};
