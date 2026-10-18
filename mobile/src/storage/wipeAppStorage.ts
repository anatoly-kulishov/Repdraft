import AsyncStorage from '@react-native-async-storage/async-storage';
import { isRepdraftOwnedStorageKey } from '@repdraft/domain/appStorageKeys';

/** QA: remove all Repdraft-owned keys from AsyncStorage. Cloud account unchanged. */
export async function wipeMobileAppStorage(): Promise<void> {
	const keys = await AsyncStorage.getAllKeys();
	const ours = keys.filter(isRepdraftOwnedStorageKey);
	if (ours.length > 0) await AsyncStorage.multiRemove(ours);
}
