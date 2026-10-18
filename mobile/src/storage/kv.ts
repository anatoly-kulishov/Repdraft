import AsyncStorage from '@react-native-async-storage/async-storage';

export async function kvGet(key: string): Promise<string | null> {
	return AsyncStorage.getItem(key);
}

export async function kvSet(key: string, value: string): Promise<void> {
	await AsyncStorage.setItem(key, value);
}

export async function kvRemove(key: string): Promise<void> {
	await AsyncStorage.removeItem(key);
}

export async function kvGetJson<T>(key: string, fallback: T): Promise<T> {
	try {
		const raw = await kvGet(key);
		if (!raw) return fallback;
		return JSON.parse(raw) as T;
	} catch {
		return fallback;
	}
}

export async function kvSetJson(key: string, value: unknown): Promise<void> {
	await kvSet(key, JSON.stringify(value));
}
