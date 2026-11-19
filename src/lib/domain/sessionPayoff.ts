/**
 * Numbers shown after a workout and on the live set screen. Pure domain.
 */
import { weekKeyFromDate } from './quest';
import { exerciseBestWeightKg, sessionVolumeKg } from './sessionStats';
import { isProgressSet } from './sessionSetKind';
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

export type NextWeightKind = 'raise' | 'repeat' | 'wave';

export type NextWeightHint = {
	weightKg: number;
	reps: number;
	/** raise: hit the target, add a plate. repeat: missed, same weight. wave: every 4th time, about 90%. */
	kind: NextWeightKind;
};

const PLATE_KG = 2.5;

function roundTenth(kg: number): number {
	return Math.round(kg * 10) / 10;
}

function roundPlate(kg: number): number {
	return roundTenth(Math.round(kg / PLATE_KG) * PLATE_KG);
}

type TopWork = {
	weightKg: number;
	reps: number;
	setsAtWeight: number;
	targetSets: number;
	targetReps: number;
};

/** Heaviest working sets of one exercise. Reps are the lowest at that weight. */
function topWork(session: WorkoutSession, exerciseId: string): TopWork | null {
	const ex = session.exercises.find((item) => item.exerciseId === exerciseId);
	if (!ex || ex.skipped) return null;
	const progress = ex.sets.filter(
		(set) =>
			set.completed &&
			isProgressSet(set) &&
			set.weightKg != null &&
			set.weightKg > 0
	);
	if (progress.length === 0) return null;
	let weightKg = 0;
	for (const set of progress) {
		if (set.weightKg != null && set.weightKg > weightKg) weightKg = set.weightKg;
	}
	const atTop = progress.filter((set) => set.weightKg != null && Math.abs(set.weightKg - weightKg) < 0.05);
	let reps = Number.POSITIVE_INFINITY;
	for (const set of atTop) {
		const value = set.reps ?? 0;
		if (value < reps) reps = value;
	}
	return {
		weightKg,
		reps: Number.isFinite(reps) ? reps : 0,
		setsAtWeight: atTop.length,
		targetSets: ex.targetSets,
		targetReps: ex.targetReps
	};
}

function lighterWave(weightKg: number): number {
	const eased = roundPlate(weightKg * 0.9);
	if (eased > 0 && eased < weightKg) return eased;
	const stepped = roundTenth(weightKg - PLATE_KG);
	return stepped > 0 ? stepped : weightKg;
}

/**
 * Next exposure for one exercise.
 * Hit the planned sets and reps: +2.5 kg, reps back to the target.
 * Missed: same weight, still aim at the target.
 * Every 4th exposure: a lighter wave, about 90% of the last top weight.
 * No 1RM and no multi-week percent program.
 */
export function nextWeightHint(
	sessions: readonly WorkoutSession[],
	exerciseId: string
): NextWeightHint | null {
	const exposures = sessions
		.filter((session) => session.finishedAt != null && topWork(session, exerciseId) != null)
		.sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''));
	const previous = exposures[0];
	if (!previous) return null;
	const top = topWork(previous, exerciseId);
	if (!top || top.weightKg <= 0) return null;

	const aimReps = top.targetReps > 0 ? top.targetReps : top.reps > 0 ? top.reps : 8;
	const hitSets = top.targetSets <= 0 || top.setsAtWeight >= top.targetSets;
	const hitReps = top.targetReps <= 0 || top.reps >= top.targetReps;
	const waveDue = exposures.length % 4 === 3;

	if (waveDue) {
		return { weightKg: lighterWave(top.weightKg), reps: aimReps, kind: 'wave' };
	}
	if (!hitSets || !hitReps) {
		return { weightKg: roundTenth(top.weightKg), reps: aimReps, kind: 'repeat' };
	}
	return { weightKg: roundTenth(top.weightKg + PLATE_KG), reps: aimReps, kind: 'raise' };
}

export function nextHintMessageKey(kind: NextWeightKind): string {
	switch (kind) {
		case 'raise':
			return 'quest.nextHint';
		case 'repeat':
			return 'quest.nextHintRepeat';
		case 'wave':
			return 'quest.nextHintWave';
		default: {
			const exhaustive: never = kind;
			return exhaustive;
		}
	}
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

function hintSession(
	id: string,
	at: string,
	sets: { weightKg: number; reps: number }[],
	targetSets = 3,
	targetReps = 8
): WorkoutSession {
	return {
		id,
		planId: 'p',
		planName: 'P',
		startedAt: at,
		finishedAt: at,
		exercises: [
			{
				exerciseId: 'squat',
				targetSets,
				targetReps,
				restSec: 90,
				sets: sets.map((set) => ({
					weightKg: set.weightKg,
					reps: set.reps,
					completed: true,
					kind: 'work' as const
				}))
			}
		]
	};
}

export function runSessionPayoffSelfCheck(): void {
	const hit = hintSession('a', '2026-01-01T10:00:00.000Z', [
		{ weightKg: 60, reps: 8 },
		{ weightKg: 60, reps: 8 },
		{ weightKg: 60, reps: 8 }
	]);
	const raised = nextWeightHint([hit], 'squat');
	if (!raised || raised.kind !== 'raise' || raised.weightKg !== 62.5 || raised.reps !== 8) {
		throw new Error('hit target must add 2.5 kg and keep target reps');
	}

	const extra = hintSession('b', '2026-01-02T10:00:00.000Z', [
		{ weightKg: 60, reps: 10 },
		{ weightKg: 60, reps: 10 },
		{ weightKg: 60, reps: 10 }
	]);
	const afterExtra = nextWeightHint([extra], 'squat');
	if (!afterExtra || afterExtra.kind !== 'raise' || afterExtra.reps !== 8) {
		throw new Error('extra reps still aim at the planned reps');
	}

	const miss = hintSession('c', '2026-01-03T10:00:00.000Z', [
		{ weightKg: 60, reps: 8 },
		{ weightKg: 60, reps: 8 },
		{ weightKg: 60, reps: 6 }
	]);
	const repeated = nextWeightHint([miss], 'squat');
	if (!repeated || repeated.kind !== 'repeat' || repeated.weightKg !== 60 || repeated.reps !== 8) {
		throw new Error('missed reps must repeat the weight');
	}

	const short = hintSession('d', '2026-01-04T10:00:00.000Z', [
		{ weightKg: 60, reps: 8 },
		{ weightKg: 60, reps: 8 }
	]);
	const shortHint = nextWeightHint([short], 'squat');
	if (!shortHint || shortHint.kind !== 'repeat') {
		throw new Error('fewer sets than planned must repeat the weight');
	}

	const wave = nextWeightHint(
		[
			hintSession('w1', '2026-01-01T10:00:00.000Z', [
				{ weightKg: 80, reps: 8 },
				{ weightKg: 80, reps: 8 },
				{ weightKg: 80, reps: 8 }
			]),
			hintSession('w2', '2026-01-08T10:00:00.000Z', [
				{ weightKg: 80, reps: 8 },
				{ weightKg: 80, reps: 8 },
				{ weightKg: 80, reps: 8 }
			]),
			hintSession('w3', '2026-01-15T10:00:00.000Z', [
				{ weightKg: 80, reps: 8 },
				{ weightKg: 80, reps: 8 },
				{ weightKg: 80, reps: 8 }
			])
		],
		'squat'
	);
	if (!wave || wave.kind !== 'wave' || wave.weightKg !== 72.5 || wave.reps !== 8) {
		throw new Error(`4th exposure must be a lighter wave, got ${wave?.kind} ${wave?.weightKg}`);
	}

	if (nextWeightHint([], 'squat') != null) {
		throw new Error('no history must not invent a weight');
	}
	if (nextHintMessageKey('raise') !== 'quest.nextHint') {
		throw new Error('raise hint key drifted');
	}
	if (nextHintMessageKey('repeat') !== 'quest.nextHintRepeat') {
		throw new Error('repeat hint key drifted');
	}
	if (nextHintMessageKey('wave') !== 'quest.nextHintWave') {
		throw new Error('wave hint key drifted');
	}
}
