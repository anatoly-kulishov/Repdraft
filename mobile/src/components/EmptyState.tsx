import { useMemo } from 'react';
import { StyleSheet, Text, View, type ColorValue } from 'react-native';
import { useAppColors } from '../state/theme';
import { fontFamily, radius, space, type ColorPalette } from '../theme';
import { PrimaryButton } from './PrimaryButton';

type Props = {
	title: string;
	description?: string;
	icon?: React.ElementType;
	actionLabel?: string;
	onAction?: () => void;
};

export function EmptyState({ title, description, icon: Icon, actionLabel, onAction }: Props) {
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);

	return (
		<View style={styles.root}>
			{Icon ? (
				<View style={styles.iconWrap}>
					<Icon size={28} color={colors.accent as ColorValue} strokeWidth={1.5} />
				</View>
			) : null}
			<Text style={styles.title}>{title}</Text>
			{description ? <Text style={styles.description}>{description}</Text> : null}
			{actionLabel && onAction ? (
				<View style={styles.actionWrap}>
					<PrimaryButton label={actionLabel} onPress={onAction} />
				</View>
			) : null}
		</View>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		root: {
			marginTop: space.xl,
			marginHorizontal: space.md,
			padding: space.lg,
			borderRadius: radius.md,
			borderWidth: 1,
			borderStyle: 'dashed',
			borderColor: colors.border,
			backgroundColor: colors.panel,
			alignItems: 'center',
			justifyContent: 'center',
			gap: space.sm,
			minHeight: 180
		},
		iconWrap: {
			width: 52,
			height: 52,
			borderRadius: 26,
			backgroundColor: colors.accentDim,
			alignItems: 'center',
			justifyContent: 'center',
			marginBottom: space.sm
		},
		title: {
			color: colors.text,
			fontSize: 17,
			fontWeight: '700',
			textAlign: 'center',
			fontFamily: fontFamily.bold
		},
		description: {
			color: colors.muted,
			fontSize: 14,
			lineHeight: 20,
			textAlign: 'center',
			fontFamily: fontFamily.regular
		},
		actionWrap: {
			alignSelf: 'stretch',
			marginTop: space.sm
		}
	});
}
