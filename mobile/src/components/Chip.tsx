import { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useAppColors } from '../state/theme';
import { fontFamily, radius, space, touchMin, type ColorPalette } from '../theme';

type Props = {
	label: string;
	selected?: boolean;
	onPress: () => void;
};

/** Soft selection like web `.catalog-filter-chip` (not solid accent fill). */
export function Chip({ label, selected, onPress }: Props) {
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{ selected }}
			onPress={onPress}
			style={[styles.chip, selected && styles.chipOn]}
		>
			<Text style={[styles.text, selected && styles.textOn]} numberOfLines={1}>
				{label}
			</Text>
		</Pressable>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		chip: {
			minHeight: touchMin,
			minWidth: touchMin,
			justifyContent: 'center',
			alignItems: 'center',
			paddingHorizontal: space.md,
			borderRadius: radius.pill,
			borderWidth: 1,
			borderColor: colors.border,
			backgroundColor: colors.panel
		},
		chipOn: {
			borderColor: colors.accent,
			backgroundColor: colors.accentDim
		},
		text: {
			color: colors.muted,
			fontSize: 15,
			fontWeight: '600',
			fontFamily: fontFamily.semibold
		},
		textOn: {
			color: colors.accentText,
			fontWeight: '700',
			fontFamily: fontFamily.bold
		}
	});
}
