import { useMemo } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { CloudDownload } from 'lucide-react-native';
import { SettingsGroup } from '../../src/profile/SettingsGroup';
import { SettingsRow } from '../../src/profile/SettingsRow';
import { useLocale } from '../../src/state/locale';
import { useAppColors } from '../../src/state/theme';
import { space } from '../../src/theme';
import { useBottomChromePad } from '../../src/layout/safe';

/**
 * Data export/import stay on the profile tab for now (file pickers + review sheet).
 * This screen deep-links back to profile.
 */
export default function SettingsDataScreen() {
	const router = useRouter();
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors.bg), [colors.bg]);
	const bottomPad = useBottomChromePad(space.lg);

	return (
		<ScrollView
			style={styles.scroll}
			contentContainerStyle={[styles.root, { paddingBottom: bottomPad }]}
		>
			<SettingsGroup hint={`${tt('settings.exportHint')} ${tt('profile.backupHint')}`}>
				<SettingsRow
					icon={CloudDownload}
					label={tt('profile.export')}
					onPress={() => router.replace('/(tabs)/profile')}
				/>
			</SettingsGroup>
		</ScrollView>
	);
}

function makeStyles(bg: string) {
	return StyleSheet.create({
		scroll: { flex: 1, backgroundColor: bg },
		root: { padding: space.lg, gap: space.md }
	});
}
