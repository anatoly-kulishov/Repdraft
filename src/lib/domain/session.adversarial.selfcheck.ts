/**
 * Adversarial sacred-loop attacks (session + plan→start).
 * Asserts contract invariants only — every attack below is expected to FAIL
 * until domain gates exist. Do not “fix” production here.
 *
 * Run:
 *   node --import ./scripts/register-domain-selfcheck.mjs --experimental-strip-types ./src/lib/domain/session.adversarial.selfcheck.ts
 */
import { SETS, WEIGHT_KG, LIVE_REPS } from './inputLimits.ts';
import {
	addLoggedSet,
	completedSetCount,
	finishSession,
	isSessionFullyLogged,
	nextManualExerciseFocus,
	sessionVolumeKg,
	startSessionFromPlan,
	updateLoggedSet
} from './session.ts';
import { addExercise, createEmptyDraft, updateExercise } from './workout.ts';
import type { WorkoutPlan } from './types.ts';

function assert(condition: boolean, message: string): void {
	if (!condition) throw new Error(message);
}

function oneExercisePlan(): WorkoutPlan {
	return addExercise(createEmptyDraft('Attack'), 'ex-a').plan;
}

const failures: string[] = [];

function attack(name: string, fn: () => void): void {
	try {
		fn();
		console.log(`PASS (not broken): ${name}`);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		failures.push(`${name} :: ${msg}`);
		console.error(`FAIL: ${name}\n  ${msg}`);
	}
}

attack('log.rejects-negative-weight', () => {
	let s = startSessionFromPlan(oneExercisePlan());
	s = updateLoggedSet(s, 0, 0, { weightKg: -40, reps: 8, completed: true });
	const w = s.exercises[0]!.sets[0]!.weightKg;
	assert(
		w == null || w >= WEIGHT_KG.min,
		`negative weight accepted: weightKg=${String(w)} volume=${sessionVolumeKg(s)}`
	);
});

attack('log.rejects-nan-weight', () => {
	let s = startSessionFromPlan(oneExercisePlan());
	s = updateLoggedSet(s, 0, 0, { weightKg: Number.NaN, reps: 8, completed: true });
	const w = s.exercises[0]!.sets[0]!.weightKg;
	assert(
		w == null || Number.isFinite(w),
		`NaN weight accepted: weightKg=${String(w)} volumeNaN=${Number.isNaN(sessionVolumeKg(s))}`
	);
});

attack('log.rejects-negative-reps', () => {
	let s = startSessionFromPlan(oneExercisePlan());
	s = updateLoggedSet(s, 0, 0, { weightKg: 50, reps: -3, completed: true });
	const reps = s.exercises[0]!.sets[0]!.reps;
	assert(
		reps == null || reps >= LIVE_REPS.min,
		`negative reps accepted: reps=${String(reps)} volume=${sessionVolumeKg(s)}`
	);
});

attack('log.clamps-weight-and-reps-to-bounds', () => {
	let s = startSessionFromPlan(oneExercisePlan());
	s = updateLoggedSet(s, 0, 0, {
		weightKg: WEIGHT_KG.max + 50,
		reps: LIVE_REPS.max + 50,
		completed: true
	});
	const set = s.exercises[0]!.sets[0]!;
	assert(
		(set.weightKg ?? 0) <= WEIGHT_KG.max && (set.reps ?? 0) <= LIVE_REPS.max,
		`over-max log accepted: weightKg=${String(set.weightKg)} reps=${String(set.reps)}`
	);
});

attack('finish.allows-early-finish', () => {
	const open = startSessionFromPlan(oneExercisePlan());
	assert(!isSessionFullyLogged(open), 'setup: open session must not be fully logged');
	assert(completedSetCount(open) === 0, 'setup: zero completed sets');
	const done = finishSession(open);
	assert(
		!!done.finishedAt,
		'early finish must stamp finishedAt (leave-gym is intentional)'
	);
});

attack('finish.empty-plan-may-stamp', () => {
	const empty = startSessionFromPlan(createEmptyDraft('Empty'));
	assert(empty.exercises.length === 0, 'setup: empty plan yields 0 exercises');
	const done = finishSession(empty);
	assert(
		!!done.finishedAt,
		'empty plan finish stamps (no coded gate; intentional soft allow)'
	);
});

attack('finish.idempotent-second-call', () => {
	let s = updateLoggedSet(startSessionFromPlan(oneExercisePlan()), 0, 0, {
		weightKg: 40,
		reps: 8,
		completed: true
	});
	// mark remaining open so finish is the only gate under test when incomplete finish is fixed
	for (let si = 1; si < s.exercises[0]!.sets.length; si++) {
		s = updateLoggedSet(s, 0, si, { weightKg: 40, reps: 8, completed: true });
	}
	s = finishSession(s);
	const firstStamp = s.finishedAt;
	assert(!!firstStamp, 'setup: first finish should stamp');
	Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
	const again = finishSession(s);
	assert(
		again.finishedAt === firstStamp,
		`second finishSession rewrote finishedAt ${firstStamp} → ${again.finishedAt}`
	);
});

attack('finish.history-edit-still-allowed', () => {
	let s = updateLoggedSet(startSessionFromPlan(oneExercisePlan()), 0, 0, {
		weightKg: 10,
		reps: 5,
		completed: true
	});
	s = finishSession(s);
	assert(!!s.finishedAt, 'setup: finished');
	const mutated = updateLoggedSet(s, 0, 0, { weightKg: 20, reps: 6 });
	assert(
		mutated.exercises[0]!.sets[0]!.weightKg === 20 &&
			mutated.exercises[0]!.sets[0]!.reps === 6,
		'history edit must still updateLoggedSet after finishedAt'
	);
});

attack('next.oob-index-stays-in-bounds', () => {
	let p = oneExercisePlan();
	p = addExercise(p, 'ex-b').plan;
	const s = startSessionFromPlan(p);
	const focus = nextManualExerciseFocus(s, 99);
	assert(
		focus >= 0 && focus < s.exercises.length,
		`nextManualExerciseFocus(99) returned OOB index ${focus}`
	);
});

attack('log.addLoggedSet-respects-SETS.max', () => {
	let s = startSessionFromPlan(oneExercisePlan());
	for (let i = 0; i < SETS.max + 20; i++) {
		s = addLoggedSet(s, 0);
	}
	const len = s.exercises[0]!.sets.length;
	assert(len <= SETS.max, `addLoggedSet grew to ${len} sets (SETS.max=${SETS.max})`);
});

attack('plan.updateExercise-rejects-nan-sets', () => {
	let p = oneExercisePlan();
	p = updateExercise(p, 'ex-a', { sets: Number.NaN });
	const sets = p.exercises[0]!.sets;
	assert(
		Number.isFinite(sets) && sets >= 1,
		`updateExercise stored NaN sets=${String(sets)}`
	);
	const s = startSessionFromPlan(p);
	assert(
		s.exercises[0]!.sets.length >= 1,
		`NaN sets → startSession produced ${s.exercises[0]!.sets.length} log slots`
	);
});

attack('start.allows-duplicate-exercise-ids', () => {
	const plan: WorkoutPlan = {
		id: 'dup',
		name: 'Dup',
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z',
		exercises: [
			{ exerciseId: 'ex-a', sets: 2, reps: 8, restSec: 60 },
			{ exerciseId: 'ex-a', sets: 2, reps: 10, restSec: 90 }
		]
	};
	const s = startSessionFromPlan(plan);
	const ids = s.exercises.map((ex) => ex.exerciseId);
	assert(
		ids.length === 2 && ids[0] === 'ex-a' && ids[1] === 'ex-a',
		`same exercise twice in a plan is valid: got ${ids.join(',')}`
	);
});

if (failures.length === 0) {
	console.log('session.adversarial.selfcheck: zero failing attacks');
	process.exit(0);
}

console.error(`\nsession.adversarial.selfcheck: ${failures.length} break(s)`);
for (const f of failures) console.error(` - ${f}`);
process.exit(1);
