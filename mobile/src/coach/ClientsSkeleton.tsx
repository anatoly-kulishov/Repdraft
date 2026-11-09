import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { fontFamily, radius, space, type ColorPalette } from '../theme';

/** Compact boot loader; same card height band as the empty state. */
export function ClientsSkeleton() {
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	return (
		<View
			style={styles.bootCard}
			accessibilityLabel={tt('common.loading')}
			accessibilityRole="progressbar"
			accessibilityState={{ busy: true }}
		>
			<ActivityIndicator color={colors.accent} size="large" />
			<Text style={styles.label}>{tt('common.loading')}</Text>
		</View>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		bootCard: {
			backgroundColor: colors.panel,
			borderRadius: radius.md,
			paddingHorizontal: space.lg,
			paddingVertical: 36,
			minHeight: 184,
			alignItems: 'center',
			justifyContent: 'center',
			gap: space.md
		},
		label: {
			color: colors.muted,
			fontSize: 14,
			fontFamily: fontFamily.regular,
			textAlign: 'center'
		}
	});
}
