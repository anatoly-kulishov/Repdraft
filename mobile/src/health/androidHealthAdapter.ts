import { Platform } from 'react-native';
import type { HealthAdapter, HealthPermissionStatus, HealthWorkoutSnapshot } from './types';

/**
 * Health Connect adapter scaffold for Android development builds.
 * Real read APIs need a config plugin + native module (not Expo Go).
 * Until wired, reports unavailable so Profile can hide/disable cleanly.
 */
export const androidHealthAdapter: HealthAdapter = {
	isAvailable() {
		return Platform.OS === 'android';
	},
	async getPermissionStatus(): Promise<HealthPermissionStatus> {
		if (Platform.OS !== 'android') return 'unavailable';
		// ponytail: Health Connect SDK not linked yet; keep unavailable until module + plugin ship.
		return 'unavailable';
	},
	async requestReadPermission(): Promise<HealthPermissionStatus> {
		if (Platform.OS !== 'android') return 'unavailable';
		return 'unavailable';
	},
	async readWorkoutWindow(_opts: {
		startedAt: string;
		finishedAt: string;
	}): Promise<HealthWorkoutSnapshot | null> {
		return null;
	}
};
