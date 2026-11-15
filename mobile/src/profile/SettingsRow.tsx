import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useAppColors } from '../state/theme';
import { fontFamily, radius, touchMin, type ColorPalette } from '../theme';

type IconComponent = typeof ChevronRight;

type Props = {
	label: string;
	value?: string;
	icon?: IconComponent;
	iconColor?: string;
	onPress?: () => void;
	chevron?: boolean;
	disabled?: boolean;
	danger?: boolean;
	trailing?: ReactNode;
	accessibilityLabel?: string;
};

export function SettingsRow({
	label,
	value,
	icon: Icon,
	iconColor,
	onPress,
	chevron,
	disabled = false,
	danger = false,
	trailing,
	accessibilityLabel
}: Props) {
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const showChevron = chevron ?? Boolean(onPress && !trailing);
	const content = (
		<>
			{Icon ? (
				<Icon
					color={danger ? colors.danger : (iconColor ?? colors.text)}
					size={18}
					strokeWidth={2}
				/>
			) : null}
			<Text
				style={[styles.label, danger && styles.labelDanger, !Icon && styles.labelFull]}
				numberOfLines={2}
			>
				{label}
			</Text>
			{value ? (
				<Text style={styles.value} numberOfLines={1}>
					{value}
				</Text>
			) : null}
			{trailing}
			{showChevron ? <ChevronRight color={colors.muted} size={16} strokeWidth={2} /> : null}
		</>
	);

	if (onPress) {
		return (
			<Pressable
				style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
				onPress={onPress}
				disabled={disabled}
				accessibilityRole="button"
				accessibilityLabel={accessibilityLabel ?? label}
				accessibilityState={{ disabled }}
			>
				{content}
			</Pressable>
		);
	}

	return <View style={styles.row}>{content}</View>;
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		row: {
			minHeight: Math.max(touchMin, 52),
			flexDirection: 'row',
			alignItems: 'center',
			gap: 12,
			paddingVertical: 10,
			paddingHorizontal: 4
		},
		rowPressed: { opacity: 0.72 },
		label: {
			flex: 1,
			minWidth: 0,
			fontFamily: fontFamily.medium,
			fontSize: 15,
			color: colors.text
		},
		labelFull: { flex: 1 },
		labelDanger: { color: colors.danger },
		value: {
			maxWidth: 140,
			fontFamily: fontFamily.medium,
			fontSize: 14,
			color: colors.muted
		}
	});
}

export function SettingsFooterButton({
	label,
	onPress,
	disabled = false,
	danger = false
}: {
	label: string;
	onPress: () => void;
	disabled?: boolean;
	danger?: boolean;
}) {
	const colors = useAppColors();
	const styles = useMemo(
		() =>
			StyleSheet.create({
				btn: {
					minHeight: touchMin,
					alignItems: 'center',
					justifyContent: 'center',
					borderRadius: radius.md,
					backgroundColor: colors.panel,
					paddingHorizontal: 16,
					paddingVertical: 12
				},
				label: {
					fontFamily: fontFamily.semibold,
					fontSize: 15,
					color: danger ? colors.danger : colors.text
				}
			}),
		[colors, danger]
	);

	return (
		<Pressable
			style={({ pressed }) => [styles.btn, pressed && { opacity: 0.72 }]}
			onPress={onPress}
			disabled={disabled}
			accessibilityRole="button"
			accessibilityLabel={label}
		>
			<Text style={styles.label}>{label}</Text>
		</Pressable>
	);
}

export function SettingsDeleteButton({
	label,
	onPress,
	disabled = false
}: {
	label: string;
	onPress: () => void;
	disabled?: boolean;
}) {
	return (
		<SettingsFooterButton label={label} onPress={onPress} disabled={disabled} danger />
	);
}
