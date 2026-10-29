import { weekKeyFromDate } from './quest';
import { exerciseBestWeightKg } from './sessionStats';
import { sessionVolumeKg } from './session';
import type { WorkoutSession } from './types';
import {
	finishedSessionsWithinDays,
	sessionVolumeByBodyPart,
	mergeVolumeMaps,
	volumeShares,
	sessionSetsByBodyPart,
	mergeSetMaps,
	type BodyPartShare
} from './trainingLoad';
import { countableFinishedSessions } from './achievements';

export type ProgressPeriod = 7 | 30 | 90 | 'all';

export const PROGRESS_PERIODS: readonly ProgressPeriod[] = [7, 30, 90, 'all'];

/** Days of window for a period, or null for "all time". */
function periodDays(period: ProgressPeriod): number | null {
	return period === 'all' ? null : period;
}

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

/** Metric cards. Delta vs. the equal-length prior period (null for "all time"). */
export type ProgressCardMetrics = {
	workouts: number;
	/** This period − prior period in finished-session count. */
	workoutsDelta: number | null;
	volumeKg: number;
	/** This period − prior period in kg. */
	volumeKgDelta: number | null;
};

/** Share of completed working sets per body_part (spec: balance the weight bias). */
export type BodyPartSetShare = {
	bodyPart: string;
	sets: number;
	sharePct: number;
};

export type ProgressOverview = {
	/** Window this overview was computed for. */
	period: ProgressPeriod;
	/** Metric cards (spec Block 2). */
	cards: ProgressCardMetrics;
	workouts30d: number;
	volume30dKg: number;
	/** volume30dKg / workouts30d, rounded. 0 when there are no workouts. */
	avgVolumePerWorkoutKg: number;
	weeks: WeekVolume[];
	bodyParts: BodyPartShare[];
	/** Set-count share for the redesigned "Доля по группам" block. */
	setShares: BodyPartSetShare[];
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
	bodyPartFor?: (exerciseId: string) => string | null,
	opts: { period?: ProgressPeriod } = {}
): ProgressOverview {
	const period = opts.period ?? 30;
	const finished = countableFinishedSessions([...sessions]);
	const days = periodDays(period);
	const window =
		days == null ? finished : finishedSessionsWithinDays(finished, days, now);

	// Metric totals for a window.
	const totalsFor = (list: readonly WorkoutSession[]): { workouts: number; volumeKg: number } => {
		let volumeKg = 0;
		for (const s of list) volumeKg += sessionVolumeKg(s);
		return { workouts: list.length, volumeKg: Math.round(volumeKg) };
	};

	// Equal-length prior period for the metric deltas (none for "all time").
	const prior =
		days == null
			? null
			: finishedSessionsWithinDays(finished, days, new Date(now.getTime() - days * 86_400_000));
	const totals = totalsFor(window);
	const priorTotals = prior ? totalsFor(prior) : null;
	const cards: ProgressCardMetrics =
		priorTotals == null
			? {
					workouts: totals.workouts,
					workoutsDelta: null,
					volumeKg: totals.volumeKg,
					volumeKgDelta: null
				}
			: {
					workouts: totals.workouts,
					workoutsDelta: totals.workouts - priorTotals.workouts,
					volumeKg: totals.volumeKg,
					volumeKgDelta: totals.volumeKg - priorTotals.volumeKg
				};

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

	// Vol = average volume per workout for the window (0 when empty).
	const avgVolumePerWorkoutKg =
		totals.workouts > 0 ? Math.round(totals.volumeKg / totals.workouts) : 0;

	// Spec: muscle-group share by completed WORKING SETS, not by kg (legs would
	// drown arms). Keep the volume share for other callers; expose setShares here.
	const partMaps = bodyPartFor
		? window.map((session) => sessionVolumeByBodyPart(session, bodyPartFor))
		: [];
	const bodyParts = bodyPartFor
		? volumeShares(mergeVolumeMaps(partMaps))
		: [];
	const setMaps = bodyPartFor
		? window.map((session) => sessionSetsByBodyPart(session, bodyPartFor))
		: [];
	const setShares = setToShares(mergeSetMaps(setMaps));
	const laggingBodyPart =
		setShares.length >= 2 ? (setShares[setShares.length - 1]?.bodyPart ?? null) : null;

	const exerciseIds = new Set<string>();
	for (const session of window) {
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
		period,
		cards,
		workouts30d: totals.workouts,
		volume30dKg: totals.volumeKg,
		avgVolumePerWorkoutKg,
		weeks,
		bodyParts,
		setShares,
		laggingBodyPart,
		trends,
		streak: weeklyStreak(finished, now),
		bestLifts: bestLiftsWithin(window)
	};
}

/** Percent share of set counts, descending by sets. */
function setToShares(map: Map<string, number>): BodyPartSetShare[] {
	let total = 0;
	for (const v of map.values()) total += v;
	if (total <= 0) return [];
	const rows: BodyPartSetShare[] = [];
	for (const [bodyPart, sets] of map) {
		rows.push({ bodyPart, sets, sharePct: Math.round((sets / total) * 100) });
	}
	rows.sort((a, b) => b.sets - a.sets);
	return rows;
}
