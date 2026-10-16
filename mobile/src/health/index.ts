import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { kvGetJson, kvSetJson } from '../storage/kv';
import { iosHealthAdapter } from './iosHealthAdapter';
import { stubHealthAdapter } from './stubAdapter';
import type { HealthAdapter, HealthWorkoutSnapshot } from './types';

export type { HealthAdapter, HealthPermissionStatus, HealthWorkoutSnapshot } from './types';

export const HEALTH_ENABLED_KEY = 'repdraft:health-read-enabled';
const LAST_HEALTH_KEY = 'repdraft:health-last-snapshot';

type StoredHealthSnap = {
	sessionId: string;
	snap: HealthWorkoutSnapshot;
};

/**
 * Health read adapter.
 * Native HealthKit / Health Connect bindings require a development build
 * (not Expo Go). Until plugins are wired, always returns the stub.
 */
export function getHealthAdapter(): HealthAdapter {
	// Expo Go has no native HealthKit module; dev/prod client only.
	if (Constants.executionEnvironment === 'storeClient') {
		return stubHealthAdapter;
	}
	if (Platform.OS === 'ios') {
		return iosHealthAdapter;
	}
	// ponytail: Android Health Connect adapter is a follow-up; stub until wired.
	return stubHealthAdapter;
}

export async function saveLastHealthSnapshot(
	sessionId: string,
	snap: HealthWorkoutSnapshot
): Promise<void> {
	await kvSetJson(LAST_HEALTH_KEY, { sessionId, snap } satisfies StoredHealthSnap);
}

export async function loadLastHealthSnapshot(
	sessionId: string
): Promise<HealthWorkoutSnapshot | null> {
	const raw = await kvGetJson<StoredHealthSnap | null>(LAST_HEALTH_KEY, null);
	if (!raw || raw.sessionId !== sessionId || !raw.snap) return null;
	return raw.snap;
}

export function formatHealthSnapshotLine(
	snap: HealthWorkoutSnapshot,
	tt: (key: string, vars?: Record<string, string | number>) => string
): string {
	const parts: string[] = [];
	if (snap.durationMin != null) {
		parts.push(tt('health.durationMin', { n: String(snap.durationMin) }));
	}
	if (snap.activeEnergyKcal != null) {
		parts.push(tt('health.kcal', { n: String(Math.round(snap.activeEnergyKcal)) }));
	}
	if (snap.avgHeartRateBpm != null) {
		parts.push(tt('health.hrAvg', { n: String(Math.round(snap.avgHeartRateBpm)) }));
	}
	if (snap.maxHeartRateBpm != null) {
		parts.push(tt('health.hrMax', { n: String(Math.round(snap.maxHeartRateBpm)) }));
	}
	if (parts.length === 0) return tt('health.noData');
	return parts.join(' · ');
}
