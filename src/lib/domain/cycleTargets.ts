/**
 * What a cycle week actually prescribes, exercise by exercise: sets and reps come
 * from the wave (`cycleWeekVariant`), the load comes from the athlete's own logs
 * (`nextWeightHint`) — so a week is not just a percentage, it is a number the
 * athlete can put on the bar.
 *
 * The two inputs the athlete asked for:
 * - sets are written down, not implied: the week says «4 × 8», and the started
 *   session opens with those slots already filled;
 * - the load respects the implement (a 20 kg bar, a 10 kg EZ bar, dumbbell and
 *   kettlebell steps) and listens to «в отказ» sets from the previous exposure.
 *
 * Pure: no storage, no clock beyond the caller's sessions.
 */
import {
	cycleWeekVariant,
	type Mesocycle
} from './cycle';
import {
	loadProfileForEquipment,
	nextWeightHint,
	type NextWeightHint
} from './sessionPayoff';
import type { WorkoutPlan, WorkoutSession } from './types';

export type CycleExerciseTarget = {
	exerciseId: string;
	/** Sets/reps/rest of the week's variant — the same numbers the session starts with. */
	sets: number;
	reps: number;
	restSec: number;
	/** Prescribed load, or null when there is no usable history yet. */
	weightKg: number | null;
	oneRepMaxKg: number | null;
	percentOfMax: number | null;
	/** Empty implement weight already inside `weightKg` (bar), 0 when not applicable. */
	barKg: number;
	/** Why the load was picked (raise / hold after failure / ease …). */
	kind: NextWeightHint['kind'] | null;
};

export type CycleTargetsOptions = {
	sessions: readonly WorkoutSession[];
	/** Catalog equipment of the exercise — drives the bar weight and the plate step. */
	equipmentFor?: (exerciseId: string) => string | null;
};

/** Per-exercise prescription of one cycle week for one saved plan. */
export function cycleWeekTargets(
	plan: WorkoutPlan,
	week: number,
	cycle: Pick<Mesocycle, 'goal'>,
	opts: CycleTargetsOptions
): CycleExerciseTarget[] {
	const variant = cycleWeekVariant(plan, week, cycle);
	return variant.exercises.map((ex) => {
		const profile = loadProfileForEquipment(opts.equipmentFor?.(ex.exerciseId));
		const hint = nextWeightHint(opts.sessions, ex.exerciseId, {
			stepKg: profile.stepKg,
			emptyKg: profile.emptyKg,
			targetReps: ex.reps
		});
		return {
			exerciseId: ex.exerciseId,
			sets: ex.sets,
			reps: ex.reps,
			restSec: ex.restSec,
			weightKg: hint?.weightKg ?? null,
			oneRepMaxKg: hint?.oneRepMaxKg ?? null,
			percentOfMax: hint?.percentOfMax ?? null,
			barKg: profile.emptyKg,
			kind: hint?.kind ?? null
		};
	});
}

/** Loads only, ready for `live.startFromPlan({ weights })`. Empty when no history. */
export function cycleTargetWeights(
	targets: readonly CycleExerciseTarget[]
): Map<string, number> {
	const weights = new Map<string, number>();
	for (const target of targets) {
		if (target.weightKg != null && target.weightKg > 0) {
			weights.set(target.exerciseId, target.weightKg);
		}
	}
	return weights;
}

/** Whole sets across a plan's week — the number the week header shows. */
export function cycleTargetSetCount(targets: readonly CycleExerciseTarget[]): number {
	return targets.reduce((sum, target) => sum + target.sets, 0);
}

export function runCycleTargetsSelfCheck(): void {
	const plan: WorkoutPlan = {
		id: 'plan-1',
		name: 'Спина + бицепс',
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z',
		exercises: [
			{ exerciseId: 'curl-ez', sets: 3, reps: 8, restSec: 90 },
			{ exerciseId: 'row', sets: 4, reps: 10, restSec: 120 }
		]
	};
	const session = (
		id: string,
		at: string,
		exerciseId: string,
		sets: { weightKg: number; reps: number; kind?: 'work' | 'failure' }[],
		targetReps: number
	): WorkoutSession => ({
		id,
		planId: 'plan-1',
		planName: 'P',
		startedAt: at,
		finishedAt: at,
		exercises: [
			{
				exerciseId,
				targetSets: sets.length,
				targetReps,
				restSec: 90,
				sets: sets.map((set) => ({
					weightKg: set.weightKg,
					reps: set.reps,
					completed: true,
					kind: set.kind ?? ('work' as const)
				}))
			}
		]
	});
	const equipment = (id: string) => (id === 'curl-ez' ? 'ez barbell' : 'barbell');
	const sessions = [
		session('s1', '2026-01-05T10:00:00.000Z', 'curl-ez', [
			{ weightKg: 20, reps: 8 },
			{ weightKg: 20, reps: 8 },
			{ weightKg: 20, reps: 8, kind: 'failure' }
		], 8),
		session('s2', '2026-01-05T10:00:00.000Z', 'row', [
			{ weightKg: 80, reps: 8 },
			{ weightKg: 80, reps: 8 },
			{ weightKg: 80, reps: 8 },
			{ weightKg: 80, reps: 8 }
		], 8)
	];

	// Intensity week trims a set and pushes reps down; the load follows the week.
	const intensity = cycleWeekTargets(plan, 1, { goal: 'muscle' }, { sessions, equipmentFor: equipment });
	if (intensity.length !== 2) throw new Error('cycle targets: one row per exercise');
	if (intensity[0]?.sets !== 2 || intensity[0]?.reps !== 6) {
		throw new Error(
			`cycle targets: intensity week must shift sets/reps, got ${intensity[0]?.sets}×${intensity[0]?.reps}`
		);
	}
	// «В отказ» closed the plan: hold the bar, never raise it.
	if (intensity[0]?.weightKg !== 20 || intensity[0]?.kind !== 'failure-hold') {
		throw new Error(
			`cycle targets: failure must hold the load, got ${intensity[0]?.weightKg} ${intensity[0]?.kind}`
		);
	}
	// The EZ bar is part of the number, so nothing under 10 kg can be prescribed.
	if ((intensity[0]?.weightKg ?? 0) < 10) {
		throw new Error('cycle targets: EZ prescriptions keep the bar');
	}
	if (intensity[0]?.barKg !== 10 || intensity[1]?.barKg !== 20) {
		throw new Error('cycle targets: the implement weight must reach the screen');
	}
	// No history for an exercise: the week still names sets, the load stays open.
	const noHistory = cycleWeekTargets(
		{ ...plan, exercises: [{ exerciseId: 'new', sets: 3, reps: 8, restSec: 60 }] },
		1,
		{ goal: 'muscle' },
		{ sessions: [], equipmentFor: () => 'barbell' }
	);
	if (noHistory[0]?.weightKg !== null || noHistory[0]?.sets !== 2) {
		throw new Error('cycle targets: no history must not invent a load');
	}

	const weights = cycleTargetWeights(intensity);
	if (weights.get('curl-ez') !== 20 || weights.get('row') == null) {
		throw new Error('cycle targets: weights map');
	}
	if (cycleTargetSetCount(intensity) !== intensity[0]!.sets + intensity[1]!.sets) {
		throw new Error('cycle targets: set count');
	}
	// A volume week adds a set; the load is still bounded by the gear grid.
	const volume = cycleWeekTargets(plan, 2, { goal: 'muscle' }, { sessions, equipmentFor: equipment });
	if (volume[1]!.sets !== 5 || volume[1]!.reps !== 11) {
		throw new Error(`cycle targets: volume week drifted, got ${volume[1]!.sets}×${volume[1]!.reps}`);
	}
	if (volume[1]!.weightKg! % 2.5 !== 0) {
		throw new Error('cycle targets: barbell load must sit on plates');
	}
}
