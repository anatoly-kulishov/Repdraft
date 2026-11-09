import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useLocale } from '../../src/state/locale';
import {
	isHapticRestEnabled,
	isRestSoundEnabled,
	setHapticRestEnabled,
	setRestSoundEnabled
} from '../../src/state/prefs';
import { useAppColors } from '../../src/state/theme';
import { fontFamily, space, touchMin, type ColorPalette } from '../../src/theme';
import { useBottomChromePad } from '../../src/layout/safe';
import { playRestDoneChime, unlockRestAudioFromGesture } from '../../src/audio/restChime';
import { getHealthAdapter } from '../../src/health';
import { isHealthReadEnabled, setHealthReadEnabled } from '../../src/state/healthPrefs';

export default function SettingsWorkoutScreen() {
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const bottomPad = useBottomChromePad(space.lg);
	const [restSound, setRestSound] = useState(true);
	const [hapticRest, setHapticRest] = useState(true);
	const [healthOn, setHealthOn] = useState(false);
	const healthAvailable = getHealthAdapter().isAvailable();
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
				setRestSound(await isRestSoundEnabled());
				setHapticRest(await isHapticRestEnabled());
				setHealthOn(await isHealthReadEnabled());
			})();
		}, [])
	);

	return (
		<ScrollView
			style={styles.scroll}
			contentContainerStyle={[styles.root, { paddingBottom: bottomPad }]}
		>
			<View style={styles.row}>
				<Text style={styles.rowText} numberOfLines={2}>
					{tt('profile.restSound')}
				</Text>
				<Switch
					value={restSound}
					trackColor={switchColors.trackColor}
					thumbColor={switchColors.thumbColor}
					onValueChange={(v) => {
						setRestSound(v);
						void setRestSoundEnabled(v);
						if (v) {
							unlockRestAudioFromGesture();
							void playRestDoneChime();
						}
					}}
				/>
			</View>
			<View style={styles.row}>
				<Text style={styles.rowText} numberOfLines={2}>
					{tt('profile.hapticRest')}
				</Text>
				<Switch
					value={hapticRest}
					trackColor={switchColors.trackColor}
					thumbColor={switchColors.thumbColor}
					onValueChange={(v) => {
						setHapticRest(v);
						void setHapticRestEnabled(v);
					}}
				/>
			</View>
			<Text style={styles.hint}>{tt('settings.restSoundHint')}</Text>

			<Text style={styles.groupTitle}>{tt('health.title')}</Text>
			<View style={styles.row}>
				<Text style={styles.rowText} numberOfLines={2}>
					{tt('health.toggle')}
				</Text>
				<Switch
					value={healthOn}
					trackColor={switchColors.trackColor}
					thumbColor={switchColors.thumbColor}
					onValueChange={(v) => {
						setHealthOn(v);
						void setHealthReadEnabled(v);
					}}
					disabled={!healthAvailable}
				/>
			</View>
			<Text style={styles.hint}>
				{healthAvailable ? tt('health.hint') : tt('health.needDevBuild')}
			</Text>
		</ScrollView>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		scroll: { flex: 1, backgroundColor: colors.bg },
		root: { padding: space.lg, gap: 10 },
		groupTitle: {
			fontFamily: fontFamily.bold,
			fontSize: 16,
			color: colors.text,
			marginTop: space.md
		},
		row: {
			minHeight: touchMin,
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'space-between',
			gap: 12
		},
		rowText: { flex: 1, fontFamily: fontFamily.medium, fontSize: 15, color: colors.text },
		hint: { fontFamily: fontFamily.regular, fontSize: 13, color: colors.muted }
	});
}
