import { useMemo } from 'react';
import { TextInput, StyleSheet, type TextInputProps, type ColorValue } from 'react-native';
import { useAppColors } from '../state/theme';
import { fontFamily, radius, touchMin, type ColorPalette } from '../theme';

type Props = TextInputProps & {
	minHeight?: number;
};

export function AppInput({ style, minHeight = touchMin, ...rest }: Props) {
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors, minHeight), [colors, minHeight]);

	return (
		<TextInput
			placeholderTextColor={colors.muted}
			style={[styles.input, style]}
			{...rest}
		/>
	);
}

function makeStyles(colors: ColorPalette, minHeight: number) {
	return StyleSheet.create({
		input: {
			minHeight,
			borderRadius: radius.md,
			borderWidth: 1,
			borderColor: colors.border,
			backgroundColor: colors.panelRaised,
			color: colors.text,
			fontSize: 17,
			fontWeight: '600',
			paddingHorizontal: 14,
			paddingVertical: 0,
			fontFamily: fontFamily.semibold
		}
	});
}
