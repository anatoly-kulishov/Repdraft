import { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppColors } from '../state/theme';
import { fontFamily, radius, touchMin, type ColorPalette } from '../theme';

type Props = {
	label: string;
	onPress: () => void;
	disabled?: boolean;
	variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';
	compact?: boolean;
};

/**
 * Primary control. Matches web CTA look: 24px radius,
 * accent gradient fill (+ gradient on press, mirroring web hover),
 * semibold label, scale-down press.
 */
export function PrimaryButton({
	label,
	onPress,
	disabled,
	variant = 'primary',
	compact
}: Props) {
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);

	// Web CTA gradient (135deg): accentGradientStart → accentFill.
	// On hover/press web swaps to accentGradientHoverStart → accentGradientHoverEnd.
	const primaryGradient = useMemo(
		() => [colors.accentGradientStart, colors.accentFill] as const,
		[colors]
	);
	const primaryGradientPressed = useMemo(
		() => [colors.accentGradientHoverStart, colors.accentGradientHoverEnd] as const,
		[colors]
	);
	const disabledGradient = useMemo(
		() => [colors.accentFill, colors.accentFill] as const,
		[colors]
	);

	const isPrimary = variant === 'primary';

	return (
		<Pressable
			accessibilityRole="button"
			disabled={disabled}
			onPress={onPress}
			style={({ pressed }) => [
				styles.base,
				compact && styles.compact,
				!isPrimary && variant === 'secondary' && styles.secondary,
				!isPrimary && variant === 'ghost' && styles.ghost,
				!isPrimary && variant === 'danger' && styles.danger,
				!isPrimary && variant === 'link' && styles.link,
				disabled && styles.disabled,
				!disabled && pressed && styles.pressed
			]}
		>
			{({ pressed }) =>
				isPrimary ? (
					<LinearGradient
						colors={disabled ? disabledGradient : pressed ? primaryGradientPressed : primaryGradient}
						start={{ x: 0, y: 1 }}
						end={{ x: 1, y: 0 }}
						style={[styles.fill, compact && styles.fillCompact]}
					>
						<Text style={[styles.label, compact && styles.labelCompact, styles.labelOnInk]}>
							{label}
						</Text>
					</LinearGradient>
				) : (
					<Text style={[styles.label, compact && styles.labelCompact]}>
						{label}
					</Text>
				)
			}
		</Pressable>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		base: {
			minHeight: touchMin,
			minWidth: touchMin,
			borderRadius: radius.xl,
			borderWidth: 1,
			borderColor: 'transparent',
			alignItems: 'center',
			justifyContent: 'center',
			paddingHorizontal: 18,
			paddingVertical: 6,
			// Fallback behind the gradient overlay (kept in palette for non-primary).
			backgroundColor: colors.accentFill,
			overflow: 'hidden'
		},
		compact: {
			paddingHorizontal: 12,
			flexShrink: 1
		},
		fill: {
			position: 'absolute',
			top: 0,
			right: 0,
			bottom: 0,
			left: 0,
			alignItems: 'center',
			justifyContent: 'center',
			paddingHorizontal: 18,
			paddingVertical: 6
		},
		fillCompact: {
			paddingHorizontal: 12
		},
		secondary: {
			backgroundColor: colors.panelRaised,
			borderColor: colors.border
		},
		ghost: {
			backgroundColor: 'transparent',
			borderColor: 'transparent'
		},
		danger: {
			backgroundColor: colors.dangerBg,
			borderColor: colors.danger
		},
		link: {
			backgroundColor: 'transparent',
			borderWidth: 0
		},
		pressed: {
			transform: [{ scale: 0.98 }]
		},
		disabled: {
			opacity: 0.42
		},
		label: {
			color: colors.text,
			fontSize: 16,
			fontWeight: '600',
			fontFamily: fontFamily.semibold,
			textAlign: 'center'
		},
		labelCompact: {
			fontSize: 15
		},
		labelOnInk: {
			color: colors.accentInk
		}
	});
}