import AsyncStorage from '@react-native-async-storage/async-storage';
import { HEALTH_ENABLED_KEY } from '../health';

export async function isHealthReadEnabled(): Promise<boolean> {
	const raw = await AsyncStorage.getItem(HEALTH_ENABLED_KEY);
	return raw === '1' || raw === 'true';
}

export async function setHealthReadEnabled(on: boolean): Promise<void> {
	await AsyncStorage.setItem(HEALTH_ENABLED_KEY, on ? '1' : '0');
}
