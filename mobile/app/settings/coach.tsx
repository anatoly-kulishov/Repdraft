import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useLocale } from '../../src/state/locale';
import { useAppColors } from '../../src/state/theme';
import { fontFamily, space, touchMin, type ColorPalette } from '../../src/theme';
import { useBottomChromePad } from '../../src/layout/safe';

export default function SettingsCoachScreen() {
	const router = useRouter();
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const bottomPad = useBottomChromePad(space.lg);

	return (
		<ScrollView
			style={styles.scroll}
			contentContainerStyle={[styles.root, { paddingBottom: bottomPad }]}
		>
			<Text style={styles.hint}>{tt('settings.section.coachHint')}</Text>
			<Pressable style={styles.row} onPress={() => router.push('/clients')}>
				<Text style={styles.rowText}>{tt('profile.clientsRow')}</Text>
				<Text style={styles.value}>→</Text>
			</Pressable>
		</ScrollView>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		scroll: { flex: 1, backgroundColor: colors.bg },
		root: { padding: space.lg, gap: 10 },
		hint: { fontFamily: fontFamily.regular, fontSize: 13, color: colors.muted },
		row: {
			minHeight: touchMin,
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'space-between',
			borderWidth: 1,
			borderColor: colors.border,
			borderRadius: 12,
			paddingHorizontal: 14,
			backgroundColor: colors.panel
		},
		rowText: { fontFamily: fontFamily.medium, fontSize: 15, color: colors.text },
		value: { fontFamily: fontFamily.medium, color: colors.muted }
	});
}
