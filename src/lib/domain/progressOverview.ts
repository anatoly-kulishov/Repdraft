import { weekKeyFromDate } from './quest';
import { sessionVolumeKg } from './session';
import type { WorkoutSession } from './types';
import { finishedSessionsWithinDays } from './trainingLoad';
import { countableFinishedSessions } from './achievements';

export type WeekVolume = {
	weekKey: string;
	volumeKg: number;
	workouts: number;
};

export type ProgressOverview = {
	workouts30d: number;
	volume30dKg: number;
	weeks: WeekVolume[];
};

export function computeProgressOverview(
	sessions: readonly WorkoutSession[],
	now: Date = new Date()
): ProgressOverview {
	const finished = countableFinishedSessions([...sessions]);
	const last30 = finishedSessionsWithinDays(finished, 30, now);
	let volume30dKg = 0;
	for (const s of last30) volume30dKg += sessionVolumeKg(s);

	const weekMap = new Map<string, { volumeKg: number; workouts: number }>();
	for (const s of finished) {
		if (!s.finishedAt) continue;
		const key = weekKeyFromDate(new Date(s.finishedAt));
		const row = weekMap.get(key) ?? { volumeKg: 0, workouts: 0 };
		row.volumeKg += Math.round(sessionVolumeKg(s));
		row.workouts += 1;
		weekMap.set(key, row);
	}

	const weeks = [...weekMap.entries()]
		.sort((a, b) => a[0].localeCompare(b[0]))
		.slice(-6)
		.map(([weekKey, row]) => ({
			weekKey,
			volumeKg: row.volumeKg,
			workouts: row.workouts
		}));

	return {
		workouts30d: last30.length,
		volume30dKg: Math.round(volume30dKg),
		weeks
	};
}
