import { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useAppColors } from '../state/theme';
import { radius, touchMin, type ColorPalette } from '../theme';

type Props = {
	label: string;
	onPress: () => void;
	disabled?: boolean;
	variant?: 'primary' | 'ghost' | 'danger';
	compact?: boolean;
};

export function PrimaryButton({
	label,
	onPress,
	disabled,
	variant = 'primary',
	compact
}: Props) {
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);

	return (
		<Pressable
			accessibilityRole="button"
			disabled={disabled}
			onPress={onPress}
			style={({ pressed }) => [
				styles.base,
				compact && styles.compact,
				variant === 'primary' && styles.primary,
				variant === 'ghost' && styles.ghost,
				variant === 'danger' && styles.danger,
				(disabled || pressed) && styles.dim
			]}
		>
			<Text
				style={[
					styles.label,
					compact && styles.labelCompact,
					variant === 'primary' && styles.labelOnAccent,
					variant === 'danger' && styles.labelDanger
				]}
				numberOfLines={1}
			>
				{label}
			</Text>
		</Pressable>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		base: {
			minHeight: touchMin,
			minWidth: touchMin,
			borderRadius: radius.md,
			paddingHorizontal: 18,
			alignItems: 'center',
			justifyContent: 'center'
		},
		compact: {
			paddingHorizontal: 12,
			flexShrink: 1
		},
		primary: {
			backgroundColor: colors.accent
		},
		ghost: {
			backgroundColor: colors.panelRaised,
			borderWidth: 1,
			borderColor: colors.border
		},
		danger: {
			backgroundColor: colors.dangerBg,
			borderWidth: 1,
			borderColor: colors.danger
		},
		dim: {
			opacity: 0.72
		},
		label: {
			color: colors.text,
			fontSize: 16,
			fontWeight: '700'
		},
		labelCompact: {
			fontSize: 14
		},
		labelOnAccent: {
			color: colors.accentText
		},
		labelDanger: {
			color: colors.danger
		}
	});
}