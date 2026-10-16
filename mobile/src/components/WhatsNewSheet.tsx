import { localizedChangelog } from '@repdraft/domain/changelog';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { radius, space, touchMin, type ColorPalette } from '../theme';

type Props = {
	visible: boolean;
	onClose: () => void;
};

export function WhatsNewSheet({ visible, onClose }: Props) {
	const { locale, tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const insets = useSafeAreaInsets();

	if (!visible) return null;

	return (
		<View style={styles.wrap} pointerEvents="box-none">
			<Pressable
				accessibilityRole="button"
				style={styles.backdrop}
				onPress={onClose}
			/>
			<View
				style={[
					styles.sheet,
					{ paddingBottom: Math.max(insets.bottom, space.lg) }
				]}
			>
				<Text style={styles.title}>{tt('changelog.title')}</Text>
				<Text style={styles.lead}>{tt('changelog.lead')}</Text>
				<ScrollView style={styles.scroll} contentContainerStyle={{ gap: space.md }}>
					{localizedChangelog(locale, 5).map((release) => (
						<View key={release.version}>
							<Text style={styles.version}>{release.label}</Text>
							{release.highlights.map((line) => (
								<Text key={line} style={styles.bullet}>
									{'• '}
									{line}
								</Text>
							))}
						</View>
					))}
				</ScrollView>
				<Pressable accessibilityRole="button" style={styles.closeBtn} onPress={onClose}>
					<Text style={styles.closeLabel}>{tt('common.close')}</Text>
				</Pressable>
			</View>
		</View>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		wrap: {
			...StyleSheet.absoluteFill,
			justifyContent: 'flex-end',
			zIndex: 100
		},
		backdrop: {
			...StyleSheet.absoluteFill,
			backgroundColor: colors.overlayScrim
		},
		sheet: {
			maxHeight: '78%',
			borderTopLeftRadius: radius.xl,
			borderTopRightRadius: radius.xl,
			borderWidth: 1,
			backgroundColor: colors.panel,
			borderColor: colors.border,
			padding: space.lg,
			gap: space.md
		},
		title: { fontSize: 20, fontWeight: '800', color: colors.text },
		lead: { fontSize: 14, lineHeight: 20, color: colors.muted },
		scroll: { flexGrow: 0 },
		version: { fontWeight: '800', fontSize: 15, marginBottom: 4, color: colors.accent },
		bullet: { fontSize: 14, lineHeight: 20, marginBottom: 4, color: colors.muted },
		closeBtn: {
			minHeight: touchMin,
			borderRadius: radius.md,
			borderWidth: 1,
			alignItems: 'center',
			justifyContent: 'center',
			backgroundColor: colors.panelRaised,
			borderColor: colors.border
		},
		closeLabel: { fontWeight: '700', fontSize: 16, color: colors.text }
	});
}
