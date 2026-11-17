import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Globe, Moon, Sparkles, Sun } from 'lucide-react-native';
import { SettingsGroup } from '../../src/profile/SettingsGroup';
import { SettingsRow } from '../../src/profile/SettingsRow';
import { useLocale } from '../../src/state/locale';
import { isReduceMotionEnabled, setReduceMotionEnabled } from '../../src/state/prefs';
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
	const [reduceMotion, setReduceMotion] = useState(false);
	const switchColors = useMemo(
		() => ({
			trackColor: { false: colors.border, true: colors.accent },
			thumbColor: colors.panel
		}),
		[colors]
	);

	useFocusEffect(
		useCallback(() => {
			void (async () => {
				setReduceMotion(await isReduceMotionEnabled());
			})();
		}, [])
	);

	return (
		<ScrollView
			style={styles.scroll}
			contentContainerStyle={[styles.root, { paddingBottom: bottomPad }]}
		>
			<SettingsGroup hint={tt('settings.reduceMotionHint')}>
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
				<SettingsRow
					icon={Sparkles}
					label={tt('settings.reduceMotion')}
					chevron={false}
					trailing={
						<Switch
							value={reduceMotion}
							trackColor={switchColors.trackColor}
							thumbColor={switchColors.thumbColor}
							onValueChange={(v) => {
								setReduceMotion(v);
								void setReduceMotionEnabled(v);
							}}
						/>
					}
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
