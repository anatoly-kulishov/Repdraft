import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { useLocale } from '../../src/state/locale';
import { useAppColors } from '../../src/state/theme';
import { fontFamily, space, type ColorPalette } from '../../src/theme';
import { useBottomChromePad } from '../../src/layout/safe';

/**
 * Data export/import stay on the profile tab for now (file pickers + review sheet).
 * This screen deep-links back with a focus hint via query is overkill; open profile.
 */
export default function SettingsDataScreen() {
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
			<Text style={styles.hint}>{tt('settings.exportHint')}</Text>
			<PrimaryButton
				label={tt('profile.export')}
				onPress={() => router.replace('/(tabs)/profile')}
			/>
			<Text style={styles.hint}>{tt('profile.backupHint')}</Text>
		</ScrollView>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		scroll: { flex: 1, backgroundColor: colors.bg },
		root: { padding: space.lg, gap: 12 },
		hint: { fontFamily: fontFamily.regular, fontSize: 13, color: colors.muted }
	});
}
