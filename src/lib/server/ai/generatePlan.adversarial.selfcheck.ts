/**
 * Confirmed adversarial fixes for AI plan pipeline — must stay green.
 *
 * Run:
 *   node --import ./scripts/register-domain-selfcheck.mjs --experimental-strip-types ./src/lib/server/ai/generatePlan.adversarial.selfcheck.ts
 */
import {
	ensureHintCoverage,
	filterKnownIds,
	filterToBodyHints,
	generateWorkoutPlan,
	padToMinExercises,
	parsePlanPayload,
	type AiPlan
} from './generatePlan.ts';
import {
	catalogWhitelist,
	desiredExerciseCountFromBrief,
	hintsFromBrief,
	loadExerciseIndex,
	slimCatalogForBrief,
	targetsFromBrief
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

/** Empty pool + empty plan → throw. Tiny pool caps need (no foreign fill). */
attack('pad.throws-when-cannot-reach-min', () => {
	const plan: AiPlan = { name: 'Empty', exercises: [] };
	let threw = false;
	try {
		padToMinExercises(plan, [], allowed, []);
	} catch {
		threw = true;
	}
	if (!threw) throw new Error('expected throw when pad pool empty');
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

/** Zone slim may be tiny; pad stays inside pool, never invents foreign ids. */
attack('pad.fills-from-relaxed-slim', () => {
	const slim = slimCatalogForBrief(index, 'шея штанга');
	if (!slim.length) throw new Error('slim empty for neck');
	if (slim.some((ex) => ex.body_part !== 'neck')) {
		throw new Error('neck slim leaked foreign zones');
	}
	const plan: AiPlan = { name: 'One', exercises: [ex(slim[0]!.id)] };
	const out = padToMinExercises(plan, slim, allowed);
	if (out.exercises.length < 1) throw new Error('pad emptied plan');
	if (out.exercises.length > slim.length) {
		throw new Error(`pad grew past zone pool: ${out.exercises.length}>${slim.length}`);
	}
	for (const row of out.exercises) {
		if (!allowed.has(row.exerciseId)) throw new Error(`unknown id ${row.exerciseId}`);
		const item = index.find((x) => x.id === row.exerciseId);
		if (item && item.body_part !== 'neck') throw new Error(`foreign ${item.body_part}`);
	}
});

/** slim.length=3 caps pad at 3 (no throw, no invent). */
attack('pad.throws-when-slim-shorter-than-min', () => {
	const slim = index.slice(0, 3);
	const plan: AiPlan = {
		name: 'Tiny',
		exercises: [ex(slim[0]!.id), ex(slim[1]!.id)]
	};
	const out = padToMinExercises(plan, slim, allowed);
	if (out.exercises.length !== 3) {
		throw new Error(`expected cap at pool size 3, got ${out.exercises.length}`);
	}
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

/** Dropped unknowns + zone slim → pad stays whitelist-only inside pool. */
attack('pipeline.pad-recovers-after-drops', () => {
	const slim = slimCatalogForBrief(index, 'грудь штанга');
	if (slim.length < MIN_EXERCISES) {
		throw new Error(`slim too small: ${slim.length}`);
	}
	let plan = parsePlanPayload({
		name: 'Mixed',
		exercises: [ex(slim[0]!.id), ex('ghost-1'), ex(slim[1]!.id), ex('ghost-2')]
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

/** «спина и трицепс»: all-back model output must gain upper-arms/triceps coverage. */
attack('pipeline.back-triceps-covers-both-zones', () => {
	const brief = 'Спина и трицепс 1 час';
	const { parts } = hintsFromBrief(brief);
	const targets = targetsFromBrief(brief);
	if (!parts.includes('back') || !parts.includes('upper arms')) {
		throw new Error(`hints want back+arms, got ${JSON.stringify(parts)}`);
	}
	if (!targets.includes('triceps')) {
		throw new Error(`targets want triceps, got ${JSON.stringify(targets)}`);
	}
	if (desiredExerciseCountFromBrief(brief) < 7) {
		throw new Error(`1 час should want ≥7, got ${desiredExerciseCountFromBrief(brief)}`);
	}
	const slim = slimCatalogForBrief(index, brief);
	const backs = slim.filter((e) => e.body_part === 'back');
	if (backs.length < 5) throw new Error('need ≥5 back in slim');
	let plan: AiPlan = {
		name: 'Спина и трицепс',
		exercises: backs.slice(0, 5).map((x) => ex(x.id))
	};
	plan = padToMinExercises(
		plan,
		slim,
		allowed,
		[],
		desiredExerciseCountFromBrief(brief)
	);
	plan = ensureHintCoverage(plan, index, parts, slim, allowed, targets);
	const rows = plan.exercises.map((e) => index.find((x) => x.id === e.exerciseId));
	const hasBack = rows.some((r) => r?.body_part === 'back');
	const hasArms = rows.some((r) => r?.body_part === 'upper arms');
	const hasTriceps = rows.some((r) => r?.target === 'triceps');
	if (!hasBack || !hasArms) {
		throw new Error(
			`missing zone after cover: back=${hasBack} arms=${hasArms} parts=${rows
				.map((r) => r?.body_part)
				.join(',')}`
		);
	}
	if (!hasTriceps) {
		throw new Error(
			`want triceps target, got ${rows
				.filter((r) => r?.body_part === 'upper arms')
				.map((r) => r?.target)
				.join(',')}`
		);
	}
	if (plan.exercises.length < 7) {
		throw new Error(`1 час pad want ≥7, got ${plan.exercises.length}`);
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
