import AsyncStorage from '@react-native-async-storage/async-storage';

const REST_SOUND_KEY = 'repdraft:rest-sound-enabled';
const HAPTIC_KEY = 'repdraft:haptic-rest-done';
const GREETING_NAME_KEY = 'repdraft:greeting-name';

export async function isRestSoundEnabled(): Promise<boolean> {
	const raw = await AsyncStorage.getItem(REST_SOUND_KEY);
	if (raw == null) return true;
	return raw === '1' || raw === 'true';
}

export async function setRestSoundEnabled(on: boolean): Promise<void> {
	await AsyncStorage.setItem(REST_SOUND_KEY, on ? '1' : '0');
}

export async function isHapticRestEnabled(): Promise<boolean> {
	const raw = await AsyncStorage.getItem(HAPTIC_KEY);
	if (raw == null) return true;
	return raw === '1' || raw === 'true';
}

export async function setHapticRestEnabled(on: boolean): Promise<void> {
	await AsyncStorage.setItem(HAPTIC_KEY, on ? '1' : '0');
}

export async function getGreetingName(): Promise<string> {
	return (await AsyncStorage.getItem(GREETING_NAME_KEY)) ?? '';
}

export async function setGreetingName(name: string): Promise<void> {
	const trimmed = name.trim().slice(0, 40);
	await AsyncStorage.setItem(GREETING_NAME_KEY, trimmed);
	return;
}
