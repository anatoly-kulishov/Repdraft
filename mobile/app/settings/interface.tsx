import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useLocale } from '../../src/state/locale';
import { useAppColors, useAppTheme } from '../../src/state/theme';
import { fontFamily, space, touchMin, type ColorPalette } from '../../src/theme';
import { useBottomChromePad } from '../../src/layout/safe';

export default function SettingsInterfaceScreen() {
	const { locale, setLocale, tt } = useLocale();
	const { mode, cycleMode } = useAppTheme();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const bottomPad = useBottomChromePad(space.lg);

	return (
		<ScrollView
			style={styles.scroll}
			contentContainerStyle={[styles.root, { paddingBottom: bottomPad }]}
		>
			<Pressable style={styles.row} onPress={() => setLocale(locale === 'ru' ? 'en' : 'ru')}>
				<Text style={styles.rowText}>{tt('profile.locale')}</Text>
				<Text style={styles.value}>{locale === 'ru' ? 'RU' : 'EN'}</Text>
			</Pressable>
			<Pressable style={styles.row} onPress={cycleMode}>
				<Text style={styles.rowText}>{tt('settings.theme')}</Text>
				<Text style={styles.value}>
					{mode === 'dark' ? tt('settings.themeDark') : tt('settings.themeLight')}
				</Text>
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
			gap: 12,
			borderWidth: 1,
			borderColor: colors.border,
			borderRadius: 12,
			paddingHorizontal: 14,
			backgroundColor: colors.panel
		},
		rowText: { fontFamily: fontFamily.medium, fontSize: 15, color: colors.text },
		value: { fontFamily: fontFamily.medium, fontSize: 14, color: colors.muted }
	});
}
