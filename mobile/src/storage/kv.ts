import AsyncStorage from '@react-native-async-storage/async-storage';

export async function kvGet(key: string): Promise<string | null> {
	try {
		return await AsyncStorage.getItem(key);
	} catch {
		return null;
	}
}

export async function kvSet(key: string, value: string): Promise<void> {
	try {
		await AsyncStorage.setItem(key, value);
	} catch {
		/* ignore quota / disk errors for MVP */
	}
}

export async function kvRemove(key: string): Promise<void> {
	try {
		await AsyncStorage.removeItem(key);
	} catch {
		/* ignore */
	}
}

export async function kvGetJson<T>(key: string, fallback: T): Promise<T> {
	const raw = await kvGet(key);
	if (!raw) return fallback;
	try {
		return JSON.parse(raw) as T;
	} catch {
		return fallback;
	}
}

export async function kvSetJson(key: string, value: unknown): Promise<void> {
	await kvSet(key, JSON.stringify(value));
}
