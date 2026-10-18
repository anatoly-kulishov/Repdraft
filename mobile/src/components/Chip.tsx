import { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useAppColors } from '../state/theme';
import { radius, space, touchMin, type ColorPalette } from '../theme';

type Props = {
	label: string;
	selected?: boolean;
	onPress: () => void;
};

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
			justifyContent: 'center',
			paddingHorizontal: space.md,
			borderRadius: radius.pill,
			borderWidth: 1,
			borderColor: colors.border,
			backgroundColor: 'transparent'
		},
		chipOn: {
			borderColor: colors.accent,
			backgroundColor: colors.accent
		},
		text: {
			color: colors.muted,
			fontSize: 15,
			fontWeight: '600'
		},
		textOn: {
			color: colors.accentText,
			fontWeight: '700'
		}
	});
}
