import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useLocale } from '../../src/state/locale';
import { useAppColors } from '../../src/state/theme';
import { fontFamily, space, touchMin, type ColorPalette } from '../../src/theme';
import { useBottomChromePad } from '../../src/layout/safe';

export default function SettingsProgressScreen() {
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
			<Pressable style={styles.row} onPress={() => router.push('/progress')}>
				<Text style={styles.rowText}>{tt('nav.progress')}</Text>
				<Text style={styles.value}>→</Text>
			</Pressable>
			<Pressable style={styles.row} onPress={() => router.push('/coach')}>
				<Text style={styles.rowText}>{tt('nav.coach')}</Text>
				<Text style={styles.value}>→</Text>
			</Pressable>
		</ScrollView>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		scroll: { flex: 1, backgroundColor: colors.bg },
		root: { padding: space.lg, gap: 8 },
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
