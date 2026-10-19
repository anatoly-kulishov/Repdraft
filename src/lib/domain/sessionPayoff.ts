/**
 * Numbers shown after a workout and on the live set screen. Pure domain.
 */
import { weekKeyFromDate } from './quest';
import { exerciseBestWeightKg, sessionVolumeKg } from './sessionStats';
import type { WorkoutSession } from './types';

export type FigureZone = 'chest' | 'shoulders' | 'arms' | 'back' | 'legs' | 'core';

export type SessionPayoff = {
	volumeKg: number;
	sets: number;
	best: { exerciseId: string; weightKg: number } | null;
	bodyParts: string[];
};

export type WeekWeightPoint = {
	weekKey: string;
	weightKg: number | null;
};

const ZONE_BY_PART: Record<string, FigureZone> = {
	chest: 'chest',
	shoulders: 'shoulders',
	'upper arms': 'arms',
	'lower arms': 'arms',
	back: 'back',
	'upper legs': 'legs',
	'lower legs': 'legs',
	waist: 'core'
};

export function figureZone(bodyPart: string): FigureZone | null {
	return ZONE_BY_PART[bodyPart] ?? null;
}

export function figureZones(bodyParts: readonly string[]): FigureZone[] {
	const zones = new Set<FigureZone>();
	for (const part of bodyParts) {
		const zone = figureZone(part);
		if (zone) zones.add(zone);
	}
	return [...zones];
}

function completedWorkSets(session: WorkoutSession) {
	const rows: { exerciseId: string; weightKg: number; reps: number }[] = [];
	for (const ex of session.exercises) {
		if (ex.skipped) continue;
		for (const set of ex.sets) {
			if (!set.completed || set.kind === 'warmup') continue;
			if (set.weightKg == null || set.weightKg <= 0) continue;
			rows.push({
				exerciseId: ex.exerciseId,
				weightKg: set.weightKg,
				reps: set.reps ?? 0
			});
		}
	}
	return rows;
}

export function sessionPayoff(
	session: WorkoutSession,
	bodyPartFor?: (exerciseId: string) => string | null
): SessionPayoff {
	let sets = 0;
	let best: SessionPayoff['best'] = null;
	const parts = new Set<string>();
	for (const ex of session.exercises) {
		if (ex.skipped) continue;
		let used = false;
		for (const set of ex.sets) {
			if (!set.completed) continue;
			sets += 1;
			used = true;
			if (set.kind === 'warmup' || set.weightKg == null || set.weightKg <= 0) continue;
			if (!best || set.weightKg > best.weightKg) {
				best = { exerciseId: ex.exerciseId, weightKg: set.weightKg };
			}
		}
		if (used && bodyPartFor) {
			const part = bodyPartFor(ex.exerciseId);
			if (part) parts.add(part);
		}
	}
	return {
		volumeKg: Math.round(sessionVolumeKg(session)),
		sets,
		best,
		bodyParts: [...parts]
	};
}

function latestFinished(
	sessions: readonly WorkoutSession[],
	match: (session: WorkoutSession) => boolean = () => true
): WorkoutSession | undefined {
	return [...sessions]
		.filter((session) => session.finishedAt != null && match(session))
		.sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''))[0];
}

/** Last six Monday weeks, oldest first. Missing weeks stay null. */
export function exerciseWeightByWeek(
	sessions: readonly WorkoutSession[],
	exerciseId: string,
	now: Date = new Date(),
	weekCount = 6
): WeekWeightPoint[] {
	const keys: string[] = [];
	const thisMonday = weekKeyFromDate(now);
	const [y, m, d] = thisMonday.split('-').map((part) => Number(part));
	const monday = new Date(y, (m || 1) - 1, d || 1);
	for (let i = weekCount - 1; i >= 0; i -= 1) {
		const day = new Date(monday);
		day.setDate(monday.getDate() - i * 7);
		keys.push(weekKeyFromDate(day));
	}
	const best = new Map<string, number>();
	for (const session of sessions) {
		if (!session.finishedAt) continue;
		const weight = exerciseBestWeightKg(session, exerciseId);
		if (weight == null) continue;
		const key = weekKeyFromDate(new Date(session.finishedAt));
		const prev = best.get(key);
		if (prev == null || weight > prev) best.set(key, weight);
	}
	return keys.map((weekKey) => ({ weekKey, weightKg: best.get(weekKey) ?? null }));
}

export function suggestRaiseExerciseId(sessions: readonly WorkoutSession[]): string | null {
	const last = latestFinished(sessions);
	if (!last) return null;
	for (const ex of last.exercises) {
		if (exerciseBestWeightKg(last, ex.exerciseId) != null) return ex.exerciseId;
	}
	return null;
}

/** Next time: last working weight plus 2.5 kg, same reps. */
export function nextWeightHint(
	sessions: readonly WorkoutSession[],
	exerciseId: string
): { weightKg: number; reps: number } | null {
	const previous = latestFinished(sessions, (session) => exerciseBestWeightKg(session, exerciseId) != null);
	if (!previous) return null;
	let reps = 0;
	let weight = 0;
	for (const row of completedWorkSets(previous)) {
		if (row.exerciseId !== exerciseId) continue;
		if (row.weightKg >= weight) {
			weight = row.weightKg;
			reps = row.reps > 0 ? row.reps : reps;
		}
	}
	if (weight <= 0) return null;
	return { weightKg: Math.round((weight + 2.5) * 10) / 10, reps: reps > 0 ? reps : 8 };
}

export function weightAboveLast(
	currentKg: number | null,
	sessions: readonly WorkoutSession[],
	exerciseId: string,
	currentSessionId?: string
): boolean {
	if (currentKg == null || currentKg <= 0) return false;
	const previous = latestFinished(
		sessions,
		(session) => session.id !== currentSessionId && exerciseBestWeightKg(session, exerciseId) != null
	);
	if (!previous) return false;
	const prev = exerciseBestWeightKg(previous, exerciseId);
	return prev != null && currentKg > prev;
}
