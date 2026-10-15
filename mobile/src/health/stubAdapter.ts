import type { HealthAdapter, HealthPermissionStatus, HealthWorkoutSnapshot } from './types';

/** Expo Go / no native Health module: read path is a quiet no-op. */
export const stubHealthAdapter: HealthAdapter = {
	isAvailable() {
		return false;
	},
	async getPermissionStatus(): Promise<HealthPermissionStatus> {
		return 'unavailable';
	},
	async requestReadPermission(): Promise<HealthPermissionStatus> {
		return 'unavailable';
	},
	async readWorkoutWindow(): Promise<HealthWorkoutSnapshot | null> {
		return null;
	}
};
