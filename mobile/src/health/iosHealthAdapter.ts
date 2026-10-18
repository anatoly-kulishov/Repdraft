import { Platform } from 'react-native';
import {
	HKQuantityTypeIdentifier,
	isHealthDataAvailable,
	queryQuantitySamples,
	queryWorkoutSamples,
	requestAuthorization
} from '@kingstinct/react-native-healthkit';
import type { HealthAdapter, HealthPermissionStatus, HealthWorkoutSnapshot } from './types';

const READ_TYPES = [
	HKQuantityTypeIdentifier.activeEnergyBurned,
	HKQuantityTypeIdentifier.heartRate
] as const;

export const iosHealthAdapter: HealthAdapter = {
	isAvailable() {
		return Platform.OS === 'ios';
	},
	async getPermissionStatus(): Promise<HealthPermissionStatus> {
		if (Platform.OS !== 'ios') return 'unavailable';
		try {
			const ok = await isHealthDataAvailable();
			return ok ? 'not_determined' : 'unavailable';
		} catch {
			return 'unavailable';
		}
	},
	async requestReadPermission(): Promise<HealthPermissionStatus> {
		if (Platform.OS !== 'ios') return 'unavailable';
		try {
			const available = await isHealthDataAvailable();
			if (!available) return 'unavailable';
			await requestAuthorization([...READ_TYPES], []);
			return 'granted';
		} catch {
			return 'denied';
		}
	},
	async readWorkoutWindow(opts): Promise<HealthWorkoutSnapshot | null> {
		if (Platform.OS !== 'ios') return null;
		try {
			const available = await isHealthDataAvailable();
			if (!available) return null;
			const from = new Date(opts.startedAt);
			const to = new Date(opts.finishedAt);
			if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
			// pad window: user may start/stop watch slightly off session times
			from.setMinutes(from.getMinutes() - 5);
			to.setMinutes(to.getMinutes() + 5);

			const workouts = await queryWorkoutSamples({
				from,
				to,
				limit: 20,
				ascending: false
			});

			let durationMin: number | null = null;
			let activeEnergyKcal: number | null = null;
			if (workouts.length > 0) {
				const w = workouts[0];
				const start = new Date(w.startDate).getTime();
				const end = new Date(w.endDate).getTime();
				if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
					durationMin = Math.max(1, Math.round((end - start) / 60_000));
				}
				const energy = w.totalEnergyBurned?.quantity;
				if (typeof energy === 'number' && Number.isFinite(energy)) {
					activeEnergyKcal = energy;
				}
			}

			const hrSamples = await queryQuantitySamples(HKQuantityTypeIdentifier.heartRate, {
				from,
				to,
				limit: 500,
				ascending: true
			});
			let avgHeartRateBpm: number | null = null;
			let maxHeartRateBpm: number | null = null;
			if (hrSamples.length > 0) {
				const values = hrSamples
					.map((s) => s.quantity)
					.filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
				if (values.length > 0) {
					maxHeartRateBpm = Math.max(...values);
					avgHeartRateBpm = Math.round(
						values.reduce((a, b) => a + b, 0) / values.length
					);
				}
			}

			if (
				durationMin == null &&
				activeEnergyKcal == null &&
				avgHeartRateBpm == null &&
				maxHeartRateBpm == null
			) {
				return null;
			}

			return {
				durationMin,
				activeEnergyKcal,
				avgHeartRateBpm,
				maxHeartRateBpm,
				source: 'healthkit'
			};
		} catch {
			return null;
		}
	}
};
