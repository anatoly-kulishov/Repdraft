import * as Haptics from 'expo-haptics';
import { Vibration } from 'react-native';
import { isHapticRestEnabled, isRestSoundEnabled } from '../state/prefs';
import { playRestDoneChime } from './restChime';

/** Fire rest-end feedback according to prefs (sound and/or haptic). */
export async function signalRestDone(): Promise<void> {
	const [soundOn, hapticOn] = await Promise.all([
		isRestSoundEnabled(),
		isHapticRestEnabled()
	]);
	if (soundOn) void playRestDoneChime();
	if (hapticOn) {
		try {
			await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
		} catch {
			Vibration.vibrate([120, 70, 160]);
		}
	}
}
