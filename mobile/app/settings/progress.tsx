import { useMemo } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { BarChart3, Sparkles } from 'lucide-react-native';
import { SettingsGroup } from '../../src/profile/SettingsGroup';
import { SettingsRow } from '../../src/profile/SettingsRow';
import { useLocale } from '../../src/state/locale';
import { useAppColors } from '../../src/state/theme';
import { space } from '../../src/theme';
import { useBottomChromePad } from '../../src/layout/safe';

export default function SettingsProgressScreen() {
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
			<SettingsGroup>
				<SettingsRow
					icon={BarChart3}
					label={tt('nav.progress')}
					onPress={() => router.push('/progress')}
				/>
				<SettingsRow
					icon={Sparkles}
					label={tt('nav.coach')}
					onPress={() => router.push('/coach')}
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
