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

export type NextWeightKind = 'raise' | 'repeat' | 'ease' | 'wave';

export type NextWeightHint = {
	weightKg: number;
	reps: number;
	/**
	 * raise: hit the plan, add load (a plate or what the estimate allows).
	 * repeat: plan missed or target reps went up, keep the weight.
	 * ease: missed twice in a row, back off a plate.
	 * wave: every 4th exposure, an easier week.
	 */
	kind: NextWeightKind;
	/** Estimated one-rep max behind the number (Epley, best recent exposure). */
	oneRepMaxKg: number | null;
	/** Planned weight as a whole percent of `oneRepMaxKg`. */
	percentOfMax: number | null;
};

const PLATE_KG = 2.5;
/** Epley extrapolates from a submaximal set; past 12 reps it measures endurance, not strength. */
const ORM_MAX_REPS = 12;
/** How many recent exposures feed the 1RM estimate. */
const ORM_EXPOSURES = 6;
/** One exposure never adds more than this share of the last top weight. */
const MAX_RAISE_RATIO = 1.1;
/** Scheduled easier week: about 90% of the prescription. */
const WAVE_RATIO = 0.9;
/** Misses in a row before backing off a plate instead of repeating. */
const MISSES_BEFORE_EASE = 2;

function roundTenth(kg: number): number {
	return Math.round(kg * 10) / 10;
}

/** Snap to a real load jump: 2.5 kg on a barbell, 2 kg on dumbbells, 4 kg on kettlebells. */
function roundToStep(kg: number, step: number): number {
	return roundTenth(Math.round(kg / step) * step);
}

/**
 * Smallest load jump the gear actually offers. Barbells and stacks move by
 * 2.5 kg, dumbbell pairs by 2 kg, kettlebells by 4 kg: suggesting 62.5 kg on a
 * dumbbell rack is advice the gym cannot follow.
 */
export function weightStepForEquipment(equipment: string | null | undefined): number {
	const key = (equipment ?? '').trim().toLowerCase();
	if (key === 'dumbbell') return 2;
	if (key === 'kettlebell') return 4;
	return PLATE_KG;
}

/** Half-kilo display value for the estimated max. */
function roundHalf(kg: number): number {
	return Math.round(kg * 2) / 2;
}

/**
 * Epley estimate for one set: `w × (1 + reps / 30)`. Returns null for a set that
 * cannot estimate strength: no load, no reps, or reps past the useful window.
 */
export function estimateSetOneRepMax(weightKg: number, reps: number): number | null {
	if (!(weightKg > 0) || !(reps > 0) || reps > ORM_MAX_REPS) return null;
	return roundTenth(weightKg * (1 + reps / 30));
}

/** Epley inverse: the load that should be good for `reps` at this max. */
function weightForReps(oneRepMaxKg: number, reps: number): number {
	return oneRepMaxKg / (1 + Math.max(1, reps) / 30);
}

/**
 * Best estimated 1RM of one exercise across recent finished exposures. Not
 * all-time: after a long break the old peak is no longer the current athlete.
 */
export function exerciseOneRepMax(
	sessions: readonly WorkoutSession[],
	exerciseId: string,
	opts: { exposures?: number } = {}
): number | null {
	const limit = Math.max(1, opts.exposures ?? ORM_EXPOSURES);
	const ordered = sessions
		.filter((session) => session.finishedAt != null)
		.sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''));
	let exposureCount = 0;
	let best: number | null = null;
	for (const session of ordered) {
		const top = topWork(session, exerciseId);
		if (!top) continue;
		exposureCount += 1;
		if (top.e1rmKg != null && (best == null || top.e1rmKg > best)) best = top.e1rmKg;
		if (exposureCount >= limit) break;
	}
	return best == null ? null : roundHalf(best);
}

type TopWork = {
	weightKg: number;
	reps: number;
	setsAtWeight: number;
	targetSets: number;
	targetReps: number;
	/** Best Epley estimate among the working sets of this exposure. */
	e1rmKg: number | null;
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
	let e1rmKg: number | null = null;
	for (const set of progress) {
		const estimate = estimateSetOneRepMax(set.weightKg ?? 0, set.reps ?? 0);
		if (estimate == null) continue;
		if (e1rmKg == null || estimate > e1rmKg) e1rmKg = estimate;
	}
	return {
		weightKg,
		reps: Number.isFinite(reps) ? reps : 0,
		setsAtWeight: atTop.length,
		targetSets: ex.targetSets,
		targetReps: ex.targetReps,
		e1rmKg
	};
}

function lighterWave(weightKg: number, step: number): number {
	const eased = roundToStep(weightKg * WAVE_RATIO, step);
	if (eased > 0 && eased < weightKg) return eased;
	const stepped = roundTenth(weightKg - step);
	return stepped > 0 ? stepped : weightKg;
}

/** Did the athlete close the planned sets and reps in this exposure? */
function closedPlan(top: TopWork): boolean {
	const hitSets = top.targetSets <= 0 || top.setsAtWeight >= top.targetSets;
	const hitReps = top.targetReps <= 0 || top.reps >= top.targetReps;
	return hitSets && hitReps;
}

/** Consecutive recent exposures that did not close the plan, capped at the ease threshold. */
function consecutiveMisses(
	exposures: readonly WorkoutSession[],
	exerciseId: string
): number {
	let count = 0;
	for (const session of exposures) {
		const top = topWork(session, exerciseId);
		if (!top) continue;
		if (closedPlan(top)) break;
		count += 1;
		if (count >= MISSES_BEFORE_EASE) break;
	}
	return count;
}

/**
 * Next exposure for one exercise, derived from the estimated 1RM instead of a
 * fixed plate.
 *
 * - The estimate reads the best recent set (`w × (1 + reps / 30)`), so reps
 *   matter: 60 × 10 says more than 60 × 8;
 * - the planned load is the share of that max the target reps call for
 *   (about 79% for 8 reps), rounded to the gear's real step (2.5 kg bar,
 *   2 kg dumbbells, 4 kg kettlebells). The target comes from today's
 *   prescription when the caller passes it (cycle weeks change reps);
 * - closed the plan: take that load, but never less than one step and never
 *   more than +10% over the last top weight (a 12-rep set must not jump 7.5 kg);
 * - missed once: keep the weight;
 * - hit, but the recent max is a whole step below the load for these reps
 *   (lagging estimate, higher rep target): keep it too, a raise would miss;
 * - missed twice in a row: back off one step (`ease`) instead of repeating a
 *   weight that clearly is not moving;
 * - every 4th exposure: `wave`, about 90% of the prescription.
 */
export function nextWeightHint(
	sessions: readonly WorkoutSession[],
	exerciseId: string,
	opts: { stepKg?: number; targetReps?: number } = {}
): NextWeightHint | null {
	const step = Math.max(0.5, opts.stepKg ?? PLATE_KG);
	const exposures = sessions
		.filter((session) => session.finishedAt != null && topWork(session, exerciseId) != null)
		.sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''));
	const previous = exposures[0];
	if (!previous) return null;
	const top = topWork(previous, exerciseId);
	if (!top || top.weightKg <= 0) return null;

	const aimReps = Math.max(
		1,
		opts.targetReps ?? (top.targetReps > 0 ? top.targetReps : top.reps > 0 ? top.reps : 8)
	);
	const oneRepMaxKg = exerciseOneRepMax(sessions, exerciseId);
	const fromMax = oneRepMaxKg == null ? null : roundToStep(weightForReps(oneRepMaxKg, aimReps), step);
	const missed = !closedPlan(top);
	const waveDue = exposures.length % 4 === 3;

	let weightKg: number;
	let kind: NextWeightKind;
	if (waveDue) {
		kind = 'wave';
		const eased = lighterWave(fromMax ?? top.weightKg, step);
		weightKg = eased < top.weightKg ? eased : lowerByStep(top.weightKg, step);
	} else if (missed) {
		if (consecutiveMisses(exposures, exerciseId) >= MISSES_BEFORE_EASE) {
			kind = 'ease';
			weightKg = lowerByStep(top.weightKg, step);
		} else {
			kind = 'repeat';
			weightKg = roundTenth(top.weightKg);
		}
	} else if (fromMax != null && fromMax <= roundTenth(top.weightKg - step)) {
		// The recent max is a whole step below the last top weight for these reps
		// (lagging estimate): hold instead of adding, a raise would miss again.
		kind = 'repeat';
		weightKg = roundTenth(top.weightKg);
	} else {
		kind = 'raise';
		const cap = roundTenth(top.weightKg * MAX_RAISE_RATIO);
		const floor = stepUp(top.weightKg, step);
		const wanted = roundToStep(Math.min(fromMax ?? floor, cap), step);
		weightKg = Math.max(floor, wanted);
	}

	const percentOfMax =
		oneRepMaxKg != null && oneRepMaxKg > 0
			? Math.round((weightKg / oneRepMaxKg) * 100)
			: null;
	return { weightKg, reps: aimReps, kind, oneRepMaxKg, percentOfMax };
}

/** Smallest gym-plausible load above `weightKg`: follows the rack, not a pure grid. */
function stepUp(weightKg: number, step: number): number {
	const candidates = [
		roundTenth(weightKg + step),
		roundToStep(weightKg + step, step),
		roundTenth(roundToStep(weightKg, step) + step)
	].filter((value) => value > weightKg + 0.001);
	candidates.sort((a, b) => a - b);
	return candidates[0] ?? roundTenth(weightKg + step);
}

/** One step down, never past the smallest load the math can produce. */
function lowerByStep(weightKg: number, step: number): number {
	const lowered = roundToStep(weightKg - step, step);
	return lowered > 0 ? lowered : roundTenth(weightKg);
}

export function nextHintMessageKey(kind: NextWeightKind): string {
	switch (kind) {
		case 'raise':
			return 'quest.nextHint';
		case 'repeat':
			return 'quest.nextHintRepeat';
		case 'ease':
			return 'quest.nextHintEase';
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
	// The number is not a blind plate: it comes from the estimated max and can name it.
	if (raised.oneRepMaxKg !== 76 || raised.percentOfMax !== 82) {
		throw new Error(`1RM basis drifted, got ${raised.oneRepMaxKg} / ${raised.percentOfMax}`);
	}
	if (estimateSetOneRepMax(0, 8) != null || estimateSetOneRepMax(60, 0) != null) {
		throw new Error('1RM guards empty load and reps');
	}
	if (estimateSetOneRepMax(60, 13) != null) {
		throw new Error('1RM refuses endurance reps');
	}
	// Today's prescription wins over the last one: a cycle week changes reps.
	const denser = nextWeightHint([hit], 'squat', { targetReps: 6 });
	if (!denser || denser.kind !== 'raise' || denser.weightKg !== 62.5 || denser.reps !== 6) {
		throw new Error(`fewer target reps raise the load, got ${denser?.weightKg} × ${denser?.reps}`);
	}
	const longer = nextWeightHint([hit], 'squat', { targetReps: 12 });
	if (!longer || longer.kind !== 'repeat' || longer.weightKg !== 60 || longer.reps !== 12) {
		throw new Error(`more target reps hold the load, got ${longer?.kind} ${longer?.weightKg}`);
	}

	// A dumbbell rack cannot offer 62.5 kg: the same advice snaps to its 2 kg step.
	const dumbbell = nextWeightHint([hit], 'squat', { stepKg: 2 });
	if (!dumbbell || dumbbell.kind !== 'raise' || dumbbell.weightKg !== 62) {
		throw new Error(`dumbbell step drifted, got ${dumbbell?.weightKg}`);
	}
	if (weightStepForEquipment('dumbbell') !== 2 || weightStepForEquipment('kettlebell') !== 4) {
		throw new Error('equipment steps drifted');
	}
	if (weightStepForEquipment('barbell') !== 2.5 || weightStepForEquipment(null) !== 2.5) {
		throw new Error('barbell step drifted');
	}

	// Off-grid logged load (61 kg) still moves: the raise lands on the next real plate.
	const odd = hintSession('o1', '2026-01-02T10:00:00.000Z', [
		{ weightKg: 61, reps: 8 },
		{ weightKg: 61, reps: 8 },
		{ weightKg: 61, reps: 8 }
	]);
	const afterOdd = nextWeightHint([odd], 'squat');
	if (!afterOdd || afterOdd.kind !== 'raise' || afterOdd.weightKg !== 62.5) {
		throw new Error(`off-grid load must still progress, got ${afterOdd?.kind} ${afterOdd?.weightKg}`);
	}

	// High-rep work has no usable 1RM: the lagging estimate holds the weight.
	const highRep = nextWeightHint(
		[
			hintSession('hr-last', '2026-01-03T10:00:00.000Z', [
				{ weightKg: 60, reps: 15 },
				{ weightKg: 60, reps: 15 },
				{ weightKg: 60, reps: 15 }
			], 3, 15),
			hintSession('hr-prev', '2026-01-02T10:00:00.000Z', [
				{ weightKg: 40, reps: 10 },
				{ weightKg: 40, reps: 10 },
				{ weightKg: 40, reps: 10 }
			], 3, 15)
		],
		'squat'
	);
	if (!highRep || highRep.kind !== 'repeat' || highRep.weightKg !== 60) {
		throw new Error(`lagging estimate must hold, got ${highRep?.kind} ${highRep?.weightKg}`);
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
	if (afterExtra.weightKg !== 62.5) {
		throw new Error(`10 reps instead of 8 still move one plate, got ${afterExtra.weightKg}`);
	}

	const far = hintSession('b2', '2026-01-02T10:00:00.000Z', [
		{ weightKg: 60, reps: 12 },
		{ weightKg: 60, reps: 12 },
		{ weightKg: 60, reps: 12 }
	]);
	const afterFar = nextWeightHint([far], 'squat');
	if (!afterFar || afterFar.kind !== 'raise' || afterFar.weightKg !== 65) {
		throw new Error(`12 reps move two plates, got ${afterFar?.kind} ${afterFar?.weightKg}`);
	}

	const capped = hintSession('b3', '2026-01-02T10:00:00.000Z', [
		{ weightKg: 100, reps: 10 },
		{ weightKg: 100, reps: 10 },
		{ weightKg: 100, reps: 10 }
	]);
	const cappedHint = nextWeightHint([capped], 'squat');
	if (!cappedHint || cappedHint.kind !== 'raise' || !(cappedHint.weightKg <= 110)) {
		throw new Error(`one exposure never adds over 10%, got ${cappedHint?.weightKg}`);
	}

	const raisedReps = hintSession('b4', '2026-01-02T10:00:00.000Z', [
		{ weightKg: 60, reps: 8 },
		{ weightKg: 60, reps: 8 },
		{ weightKg: 60, reps: 8 }
	], 3, 10);
	const afterTargetUp = nextWeightHint([raisedReps], 'squat');
	if (!afterTargetUp || afterTargetUp.kind !== 'repeat' || afterTargetUp.weightKg !== 60) {
		throw new Error(`higher target reps hold the weight, got ${afterTargetUp?.kind} ${afterTargetUp?.weightKg}`);
	}
	if (afterTargetUp.reps !== 10) {
		throw new Error('higher target reps must stay the aim');
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

	const missTwice = nextWeightHint(
		[
			hintSession('m2', '2026-01-05T10:00:00.000Z', [
				{ weightKg: 60, reps: 6 },
				{ weightKg: 60, reps: 6 },
				{ weightKg: 60, reps: 5 }
			]),
			hintSession('m1', '2026-01-04T10:00:00.000Z', [
				{ weightKg: 60, reps: 7 },
				{ weightKg: 60, reps: 6 },
				{ weightKg: 60, reps: 6 }
			])
		],
		'squat'
	);
	if (!missTwice || missTwice.kind !== 'ease' || missTwice.weightKg !== 57.5) {
		throw new Error(
			`two misses in a row back off a plate, got ${missTwice?.kind} ${missTwice?.weightKg}`
		);
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
