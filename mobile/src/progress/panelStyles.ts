import { StyleSheet } from 'react-native';
import { fontFamily, radius, space, type ColorPalette } from '../theme';

/** Shared look for the four progress panels (bars, rows, delta pills). */
export function makeProgressPanelStyles(colors: ColorPalette) {
	return StyleSheet.create({
		sectionTitle: {
			color: colors.muted,
			fontSize: 12,
			lineHeight: 16,
			fontWeight: '400',
			letterSpacing: 0.4,
			textTransform: 'uppercase',
			marginBottom: space.sm,
			fontFamily: fontFamily.regular
		},
		panelHint: {
			color: colors.muted,
			fontSize: 12,
			marginTop: -4,
			marginBottom: space.sm,
			fontFamily: fontFamily.regular
		},
		muted: { color: colors.muted, fontFamily: fontFamily.regular },
		barTrack: {
			flex: 1,
			height: 6,
			borderRadius: radius.tag / 2,
			backgroundColor: colors.panelRaised,
			overflow: 'hidden'
		},
		barFill: { height: '100%', borderRadius: radius.tag / 2, backgroundColor: colors.accent },
		barLag: { backgroundColor: colors.danger },
		row: {
			flexDirection: 'row',
			justifyContent: 'space-between',
			alignItems: 'center',
			gap: space.sm,
			paddingVertical: 6
		},
		rowName: {
			flex: 1,
			color: colors.text,
			fontSize: 14,
			fontWeight: '600',
			fontFamily: fontFamily.semibold
		},
		rowValue: {
			color: colors.muted,
			fontSize: 13,
			fontVariant: ['tabular-nums'],
			fontFamily: fontFamily.regular
		},
		pill: {
			paddingHorizontal: space.sm,
			paddingVertical: 4,
			borderRadius: 6
		},
		pillUp: { backgroundColor: colors.successBg },
		pillDown: { backgroundColor: colors.dangerBg },
		pillText: { fontSize: 12, fontWeight: '600', fontFamily: fontFamily.semibold },
		pillTextUp: { color: colors.success },
		pillTextDown: { color: colors.danger }
	});
}
