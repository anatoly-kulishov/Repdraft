import {
	radius as sharedRadius,
	space as sharedSpace,
	tabbar as sharedTabbar,
	touchMin as sharedTouchMin
} from '@repdraft/design/tokens';
import { darkPalette } from './theme/palettes';

/** @deprecated Prefer `useAppColors()` inside screens; static fallback for legacy StyleSheets. */
export const colors = darkPalette;

export { darkPalette, lightPalette } from './theme/palettes';
export type { AppThemeMode, ColorPalette } from './theme/palettes';

export const touchMin = sharedTouchMin;

export const space = sharedSpace;

export const tabbar = sharedTabbar;

export const radius = sharedRadius;

export const fontFamily = {
	regular: 'Inter_400Regular',
	medium: 'Inter_500Medium',
	semibold: 'Inter_600SemiBold',
	bold: 'Inter_700Bold',
	extrabold: 'Inter_800ExtraBold'
} as const;

export const type = {
	lead: {
		fontSize: 15,
		lineHeight: 22,
		fontWeight: '500' as const,
		fontFamily: fontFamily.regular
	},
	/** Page / hero plan name - matches web ~17/650, not a shouty 28. */
	title: { fontSize: 17, lineHeight: 22, fontWeight: '700' as const, fontFamily: fontFamily.bold },
	/** Large display (stats, summary numbers). */
	display: { fontSize: 28, lineHeight: 34, fontWeight: '800' as const, fontFamily: fontFamily.extrabold },
	header: { fontSize: 17, lineHeight: 22, fontWeight: '700' as const, fontFamily: fontFamily.bold },
	section: {
		fontSize: 17,
		lineHeight: 22,
		fontWeight: '600' as const,
		fontFamily: fontFamily.semibold
	},
	kicker: {
		fontSize: 12,
		lineHeight: 16,
		fontWeight: '700' as const,
		letterSpacing: 0.4,
		fontFamily: fontFamily.bold
	},
	body: { fontSize: 17, lineHeight: 22, fontWeight: '600' as const, fontFamily: fontFamily.semibold },
	meta: { fontSize: 13, lineHeight: 18, fontWeight: '500' as const, fontFamily: fontFamily.medium }
};
