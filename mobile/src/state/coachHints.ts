import AsyncStorage from '@react-native-async-storage/async-storage';
import {
	COACH_HIDDEN_KEY,
	COACH_SEEN_KEY,
	parseCoachHidden,
	type CoachHiddenMap
} from '@repdraft/domain/coachHints';

export async function loadCoachHidden(): Promise<CoachHiddenMap> {
	return parseCoachHidden(await AsyncStorage.getItem(COACH_HIDDEN_KEY));
}

export async function saveCoachHidden(map: CoachHiddenMap): Promise<void> {
	await AsyncStorage.setItem(COACH_HIDDEN_KEY, JSON.stringify(map));
}

/** Epoch ms of the last visit to the coach screen (0 = never). */
export async function loadCoachSeenAt(): Promise<number> {
	const raw = await AsyncStorage.getItem(COACH_SEEN_KEY);
	return Number(raw) || 0;
}

export async function markCoachSeen(): Promise<void> {
	await AsyncStorage.setItem(COACH_SEEN_KEY, String(Date.now()));
}
