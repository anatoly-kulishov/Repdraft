import AsyncStorage from '@react-native-async-storage/async-storage';
import {
	ATHLETE_PROFILE_STORAGE_KEY,
	defaultAthleteProfile,
	normalizeAthleteProfile,
	parseAthleteProfileStorage,
	serializeAthleteProfileStorage,
	type AthleteProfile
} from '@repdraft/domain/athleteProfile';
import {
	HOME_KIT_STORAGE_KEY,
	parseHomeKitStorage,
	serializeHomeKitStorage,
	type HomeKitOptionalId
} from '@repdraft/domain/homeKit';

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

export async function getHomeKitSelection(): Promise<HomeKitOptionalId[]> {
	return parseHomeKitStorage(await AsyncStorage.getItem(HOME_KIT_STORAGE_KEY));
}

export async function setHomeKitSelection(groups: readonly string[]): Promise<void> {
	await AsyncStorage.setItem(HOME_KIT_STORAGE_KEY, serializeHomeKitStorage(groups));
}

export async function getAthleteProfile(): Promise<AthleteProfile> {
	try {
		return parseAthleteProfileStorage(await AsyncStorage.getItem(ATHLETE_PROFILE_STORAGE_KEY));
	} catch {
		return defaultAthleteProfile();
	}
}

export async function setAthleteProfile(profile: AthleteProfile): Promise<void> {
	await AsyncStorage.setItem(
		ATHLETE_PROFILE_STORAGE_KEY,
		serializeAthleteProfileStorage(normalizeAthleteProfile(profile))
	);
}
