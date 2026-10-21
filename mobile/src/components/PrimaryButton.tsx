import { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useAppColors } from '../state/theme';
import { fontFamily, radius, touchMin, type ColorPalette } from '../theme';

type Props = {
	label: string;
	onPress: () => void;
	disabled?: boolean;
	variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';
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
				variant === 'secondary' && styles.secondary,
				variant === 'ghost' && styles.ghost,
				variant === 'danger' && styles.danger,
				variant === 'link' && styles.link,
				disabled && styles.disabled,
				!disabled && pressed && styles.dim
			]}
		>
			<Text
				style={[
					styles.label,
					compact && styles.labelCompact,
					variant === 'primary' && styles.labelOnInk,
					variant === 'danger' && styles.labelDanger,
					variant === 'link' && styles.labelLink
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
			borderRadius: radius.pill,
			paddingHorizontal: 18,
			alignItems: 'center',
			justifyContent: 'center'
		},
		compact: {
			paddingHorizontal: 12,
			flexShrink: 1
		},
		primary: {
			// Shared accentFill (web CTA solid); gradient stays web-only.
			backgroundColor: colors.accentFill,
			borderWidth: 1,
			borderColor: colors.accentFill
		},
		secondary: {
			backgroundColor: colors.panelRaised,
			borderWidth: 1,
			borderColor: colors.border
		},
		ghost: {
			backgroundColor: 'transparent',
			borderWidth: 1,
			borderColor: 'transparent'
		},
		danger: {
			backgroundColor: colors.dangerBg,
			borderWidth: 1,
			borderColor: colors.danger
		},
		link: {
			backgroundColor: 'transparent',
			borderWidth: 0
		},
		dim: {
			opacity: 0.88
		},
		disabled: {
			opacity: 0.42
		},
		label: {
			color: colors.text,
			fontSize: 17,
			fontWeight: '700',
			fontFamily: fontFamily.bold
		},
		labelCompact: {
			fontSize: 15
		},
		labelOnInk: {
			color: colors.accentInk
		},
		labelDanger: {
			color: colors.danger
		},
		labelLink: {
			color: colors.accentLink,
			textDecorationLine: 'underline'
		}
	});
}
