/** Read-only Health snapshot for a finished workout window. Not source of truth. */
export type HealthWorkoutSnapshot = {
	durationMin: number | null;
	activeEnergyKcal: number | null;
	avgHeartRateBpm: number | null;
	maxHeartRateBpm: number | null;
	source: 'healthkit' | 'health_connect' | 'unavailable';
};

export type HealthPermissionStatus = 'unavailable' | 'denied' | 'granted' | 'not_determined';

export type HealthAdapter = {
	/** False in Expo Go / web; true only in a native dev/prod build with Health plugins. */
	isAvailable(): boolean;
	getPermissionStatus(): Promise<HealthPermissionStatus>;
	/** Request read access. No-op when unavailable. */
	requestReadPermission(): Promise<HealthPermissionStatus>;
	/**
	 * Read metrics overlapping [startedAt, finishedAt].
	 * Returns null when unavailable, denied, or no matching workout data.
	 */
	readWorkoutWindow(opts: {
		startedAt: string;
		finishedAt: string;
	}): Promise<HealthWorkoutSnapshot | null>;
};
