import { useMemo } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Globe, Moon, Sun } from 'lucide-react-native';
import { SettingsGroup } from '../../src/profile/SettingsGroup';
import { SettingsRow } from '../../src/profile/SettingsRow';
import { useLocale } from '../../src/state/locale';
import { useAppColors, useAppTheme } from '../../src/state/theme';
import { space } from '../../src/theme';
import { useBottomChromePad } from '../../src/layout/safe';

export default function SettingsInterfaceScreen() {
	const { locale, setLocale, tt } = useLocale();
	const { mode, cycleMode } = useAppTheme();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors.bg), [colors.bg]);
	const bottomPad = useBottomChromePad(space.lg);
	const ThemeIcon = mode === 'light' ? Sun : Moon;

	return (
		<ScrollView
			style={styles.scroll}
			contentContainerStyle={[styles.root, { paddingBottom: bottomPad }]}
		>
			<SettingsGroup>
				<SettingsRow
					icon={Globe}
					label={tt('profile.locale')}
					value={locale === 'ru' ? 'RU' : 'EN'}
					onPress={() => setLocale(locale === 'ru' ? 'en' : 'ru')}
				/>
				<SettingsRow
					icon={ThemeIcon}
					label={tt('settings.theme')}
					value={mode === 'dark' ? tt('settings.themeDark') : tt('settings.themeLight')}
					onPress={cycleMode}
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
