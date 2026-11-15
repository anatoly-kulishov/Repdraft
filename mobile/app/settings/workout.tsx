import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Activity, Smartphone, Timer } from 'lucide-react-native';
import { SettingsGroup } from '../../src/profile/SettingsGroup';
import { SettingsRow } from '../../src/profile/SettingsRow';
import { useLocale } from '../../src/state/locale';
import {
	isHapticRestEnabled,
	isRestSoundEnabled,
	setHapticRestEnabled,
	setRestSoundEnabled
} from '../../src/state/prefs';
import { useAppColors } from '../../src/state/theme';
import { space } from '../../src/theme';
import { useBottomChromePad } from '../../src/layout/safe';
import { playRestDoneChime, unlockRestAudioFromGesture } from '../../src/audio/restChime';
import { getHealthAdapter } from '../../src/health';
import { isHealthReadEnabled, setHealthReadEnabled } from '../../src/state/healthPrefs';

export default function SettingsWorkoutScreen() {
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors.bg), [colors.bg]);
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
			<SettingsGroup hint={tt('settings.restSoundHint')}>
				<SettingsRow
					icon={Timer}
					label={tt('profile.restSound')}
					chevron={false}
					trailing={
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
					}
				/>
				<SettingsRow
					icon={Smartphone}
					label={tt('profile.hapticRest')}
					chevron={false}
					trailing={
						<Switch
							value={hapticRest}
							trackColor={switchColors.trackColor}
							thumbColor={switchColors.thumbColor}
							onValueChange={(v) => {
								setHapticRest(v);
								void setHapticRestEnabled(v);
							}}
						/>
					}
				/>
			</SettingsGroup>

			<SettingsGroup
				label={tt('health.title')}
				hint={healthAvailable ? tt('health.hint') : tt('health.needDevBuild')}
			>
				<SettingsRow
					icon={Activity}
					label={tt('health.toggle')}
					chevron={false}
					trailing={
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
