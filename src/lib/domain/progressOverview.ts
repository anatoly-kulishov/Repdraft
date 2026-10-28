import { weekKeyFromDate } from './quest';
import { exerciseBestWeightKg } from './sessionStats';
import { sessionVolumeKg } from './session';
import type { WorkoutSession } from './types';
import {
	finishedSessionsWithinDays,
	sessionVolumeByBodyPart,
	mergeVolumeMaps,
	volumeShares,
	type BodyPartShare
} from './trainingLoad';
import { countableFinishedSessions } from './achievements';

export type WeekVolume = {
	weekKey: string;
	volumeKg: number;
	workouts: number;
};

export type ExerciseTrend = {
	exerciseId: string;
	deltaKg: number;
};

/** Heaviest completed working set for an exercise within the window. */
export type ProgressBestLift = {
	exerciseId: string;
	weightKg: number;
	reps: number;
};

export type ProgressStreak = {
	/** Consecutive weeks with at least one finished session (this week counts if it has one). */
	streakWeeks: number;
	/** Finished sessions in the current Monday-based week. */
	thisWeekCount: number;
	/** Monday key (YYYY-MM-DD) of the current week. */
	thisWeekKey: string;
};

export type ProgressOverview = {
	workouts30d: number;
	volume30dKg: number;
	/** volume30dKg / workouts30d, rounded. 0 when there are no workouts. */
	avgVolumePerWorkoutKg: number;
	weeks: WeekVolume[];
	bodyParts: BodyPartShare[];
	laggingBodyPart: string | null;
	trends: ExerciseTrend[];
	streak: ProgressStreak;
	bestLifts: ProgressBestLift[];
};

export type Progress30d = {
	workouts: number;
	volumeKg: number;
};

/** Cheap 30-day totals for surfaces that only show a summary line (Home). */
export function progress30d(
	sessions: readonly WorkoutSession[],
	now: Date = new Date()
): Progress30d {
	const last30 = finishedSessionsWithinDays(countableFinishedSessions([...sessions]), 30, now);
	let volumeKg = 0;
	for (const session of last30) volumeKg += sessionVolumeKg(session);
	return { workouts: last30.length, volumeKg: Math.round(volumeKg) };
}

function trendDelta(
	sessions: readonly WorkoutSession[],
	exerciseId: string,
	now: Date
): number | null {
	const recentCut = now.getTime() - 21 * 86_400_000;
	const olderCut = now.getTime() - 42 * 86_400_000;
	let recent: number | null = null;
	let older: number | null = null;
	for (const session of sessions) {
		if (!session.finishedAt) continue;
		const t = Date.parse(session.finishedAt);
		if (!Number.isFinite(t)) continue;
		const weight = exerciseBestWeightKg(session, exerciseId);
		if (weight == null) continue;
		if (t >= recentCut) recent = recent == null ? weight : Math.max(recent, weight);
		else if (t >= olderCut) older = older == null ? weight : Math.max(older, weight);
	}
	if (recent == null || older == null || recent === older) return null;
	return Math.round((recent - older) * 10) / 10;
}

function minusWeeks(ms: number, weeks: number): number {
	const d = new Date(ms);
	d.setDate(d.getDate() - weeks * 7);
	return d.getTime();
}

/** Consecutive Monday-based weeks with at least one countable session. */
function weeklyStreak(finished: readonly WorkoutSession[], now: Date): ProgressStreak {
	const weekKeys = new Set<string>();
	let thisWeekCount = 0;
	const thisWeekKey = weekKeyFromDate(now);
	for (const session of finished) {
		if (!session.finishedAt) continue;
		const t = Date.parse(session.finishedAt);
		if (!Number.isFinite(t)) continue;
		const key = weekKeyFromDate(new Date(t));
		weekKeys.add(key);
		if (key === thisWeekKey) thisWeekCount += 1;
	}
	// An empty current week does not break an ongoing streak yet.
	let cursor = weekKeys.has(thisWeekKey) ? now.getTime() : minusWeeks(now.getTime(), 1);
	let streakWeeks = 0;
	while (weekKeys.has(weekKeyFromDate(new Date(cursor))) && streakWeeks < 520) {
		streakWeeks += 1;
		cursor = minusWeeks(cursor, 1);
	}
	return { streakWeeks, thisWeekCount, thisWeekKey };
}

/** Heaviest completed working set per exercise within the given sessions. */
function bestLiftsWithin(sessions: readonly WorkoutSession[]): ProgressBestLift[] {
	const best = new Map<string, ProgressBestLift>();
	for (const session of sessions) {
		for (const exercise of session.exercises) {
			if (exercise.skipped) continue;
			for (const set of exercise.sets) {
				if (!set.completed || set.weightKg == null || set.reps == null) continue;
				if (set.kind === 'warmup') continue;
				const prev = best.get(exercise.exerciseId);
				const better =
					!prev ||
					set.weightKg > prev.weightKg ||
					(set.weightKg === prev.weightKg && set.reps > prev.reps);
				if (better) {
					best.set(exercise.exerciseId, {
						exerciseId: exercise.exerciseId,
						weightKg: set.weightKg,
						reps: set.reps
					});
				}
			}
		}
	}
	return [...best.values()]
		.sort((a, b) => b.weightKg - a.weightKg || b.reps - a.reps)
		.slice(0, 5);
}

export function computeProgressOverview(
	sessions: readonly WorkoutSession[],
	now: Date = new Date(),
	bodyPartFor?: (exerciseId: string) => string | null
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

	const partMaps = bodyPartFor
		? last30.map((session) => sessionVolumeByBodyPart(session, bodyPartFor))
		: [];
	const bodyParts = volumeShares(mergeVolumeMaps(partMaps));
	const laggingBodyPart =
		bodyParts.length >= 2 ? (bodyParts[bodyParts.length - 1]?.bodyPart ?? null) : null;

	const exerciseIds = new Set<string>();
	for (const session of last30) {
		for (const ex of session.exercises) {
			if (!ex.skipped) exerciseIds.add(ex.exerciseId);
		}
	}
	const trends = [...exerciseIds]
		.map((exerciseId) => {
			const deltaKg = trendDelta(finished, exerciseId, now);
			return deltaKg == null ? null : { exerciseId, deltaKg };
		})
		.filter((row): row is ExerciseTrend => row != null)
		.sort((a, b) => Math.abs(b.deltaKg) - Math.abs(a.deltaKg))
		.slice(0, 5);

	return {
		workouts30d: last30.length,
		volume30dKg: Math.round(volume30dKg),
		avgVolumePerWorkoutKg: last30.length > 0 ? Math.round(volume30dKg / last30.length) : 0,
		weeks,
		bodyParts,
		laggingBodyPart,
		trends,
		streak: weeklyStreak(finished, now),
		bestLifts: bestLiftsWithin(last30)
	};
}
