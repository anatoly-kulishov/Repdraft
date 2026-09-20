/**
 * Confirmed adversarial fixes for AI plan pipeline — must stay green.
 *
 * Run:
 *   node --import ./scripts/register-domain-selfcheck.mjs --experimental-strip-types ./src/lib/server/ai/generatePlan.adversarial.selfcheck.ts
 */
import {
	filterKnownIds,
	filterToBodyHints,
	generateWorkoutPlan,
	padToMinExercises,
	parsePlanPayload,
	type AiPlan
} from './generatePlan.ts';
import {
	catalogWhitelist,
	loadExerciseIndex,
	slimCatalogForBrief
} from './catalog.ts';

const MIN_EXERCISES = 5;

type Attack = { id: string; run: () => void | Promise<void> };
const attacks: Attack[] = [];

function attack(id: string, run: () => void | Promise<void>) {
	attacks.push({ id, run });
}

function ex(id: string): AiPlan['exercises'][number] {
	return { exerciseId: id, sets: 3, reps: 10, restSec: 90 };
}

const index = loadExerciseIndex();
const allowed = catalogWhitelist(index);

/** Short slim alone: pad throws. With full-index fallback, recovers to MIN. */
attack('pad.throws-when-cannot-reach-min', () => {
	const slim = index.slice(0, 4);
	const plan: AiPlan = {
		name: 'Short',
		exercises: slim.map((x) => ex(x.id))
	};
	let threw = false;
	try {
		padToMinExercises(plan, slim, allowed);
	} catch {
		threw = true;
	}
	if (!threw) throw new Error('expected throw when pad cannot reach MIN=5');
});

attack('pad.recovers-via-fallback-pool', () => {
	const slim = index.slice(0, 4);
	const plan: AiPlan = {
		name: 'Short',
		exercises: slim.slice(0, 2).map((x) => ex(x.id))
	};
	const out = padToMinExercises(plan, slim, allowed, index);
	if (out.exercises.length < MIN_EXERCISES) {
		throw new Error(`got ${out.exercises.length}, want ≥${MIN_EXERCISES}`);
	}
});

/** Impossible AND briefs fall back so slim can pad to MIN. */
attack('pad.fills-from-relaxed-slim', () => {
	const slim = slimCatalogForBrief(index, 'шея штанга');
	if (slim.length < MIN_EXERCISES) {
		throw new Error(`slim too small after fallback: ${slim.length}`);
	}
	const plan: AiPlan = { name: 'One', exercises: [ex(index[0]!.id)] };
	const out = padToMinExercises(plan, slim, allowed);
	if (out.exercises.length < MIN_EXERCISES) {
		throw new Error(`got ${out.exercises.length}, want ≥${MIN_EXERCISES}`);
	}
	for (const row of out.exercises) {
		if (!allowed.has(row.exerciseId)) throw new Error(`unknown id ${row.exerciseId}`);
	}
});

/** slim.length=3 alone cannot satisfy MIN — throw. */
attack('pad.throws-when-slim-shorter-than-min', () => {
	const slim = index.slice(0, 3);
	const plan: AiPlan = {
		name: 'Tiny',
		exercises: [ex(slim[0]!.id), ex(slim[1]!.id)]
	};
	let threw = false;
	try {
		padToMinExercises(plan, slim, allowed);
	} catch {
		threw = true;
	}
	if (!threw) throw new Error('expected throw for slim.length=3');
});

/** All-unknown stays fail-closed (filter throws; no invented pad). */
attack('pipeline.all-unknown-stays-fail-closed', () => {
	const plan = parsePlanPayload({
		name: 'Fakes',
		exercises: [
			ex('totally-fake-a'),
			ex('totally-fake-b'),
			ex('totally-fake-c'),
			ex('totally-fake-d'),
			ex('totally-fake-e')
		]
	});
	let threw = false;
	try {
		filterKnownIds(plan, allowed);
	} catch {
		threw = true;
	}
	if (!threw) throw new Error('expected filterKnownIds throw on all-unknown');
});

/** Dropped unknowns + previously-empty AND brief → pad reaches MIN via fallback slim. */
attack('pipeline.pad-recovers-after-drops', () => {
	const slim = slimCatalogForBrief(index, 'кардио штанга');
	if (slim.length < MIN_EXERCISES) {
		throw new Error(`slim too small: ${slim.length}`);
	}
	let plan = parsePlanPayload({
		name: 'Mixed',
		exercises: [ex(index[0]!.id), ex('ghost-1'), ex(index[1]!.id), ex('ghost-2')]
	});
	plan = filterKnownIds(plan, allowed);
	plan = padToMinExercises(plan, slim, allowed);
	if (plan.exercises.length < MIN_EXERCISES) {
		throw new Error(`got ${plan.exercises.length}, want ≥${MIN_EXERCISES}`);
	}
});

/** Arms brief must strip leg/glute ids the model sneaks in. */
attack('pipeline.filter-body-hints-drops-legs', () => {
	const arms = index.filter((e) => e.body_part === 'upper arms');
	const leg = index.find((e) => e.body_part === 'upper legs');
	if (arms.length < 4 || !leg) throw new Error('precondition: need arms + leg in index');
	const plan = filterToBodyHints(
		{
			name: 'План на руки',
			exercises: [ex(arms[0]!.id), ex(leg.id), ex(arms[1]!.id), ex(arms[2]!.id), ex(arms[3]!.id)]
		},
		index,
		['upper arms']
	);
	if (plan.exercises.some((e) => e.exerciseId === leg.id)) {
		throw new Error('leg id survived body-hint filter');
	}
	if (plan.exercises.length !== 4) {
		throw new Error(`expected 4 arms kept, got ${plan.exercises.length}`);
	}
});

/** Zero-width space → invalid_brief. */
attack('brief.zwsp-is-invalid-brief', async () => {
	const result = await generateWorkoutPlan('\u200b');
	if (result.ok || result.code !== 'invalid_brief') {
		throw new Error(`expected invalid_brief, got ${JSON.stringify(result)}`);
	}
});

let failed = 0;
const failing: string[] = [];
for (const a of attacks) {
	try {
		await a.run();
		console.log(`PASS ${a.id}`);
	} catch (err) {
		failed += 1;
		failing.push(a.id);
		console.error(`FAIL ${a.id}: ${(err as Error).message}`);
	}
}

if (failed > 0) {
	console.error(`\nadversarial: ${failed}/${attacks.length} failing`);
	console.error(failing.join('\n'));
	process.exit(1);
}
console.log(`\nadversarial: ${attacks.length}/${attacks.length} passing`);
