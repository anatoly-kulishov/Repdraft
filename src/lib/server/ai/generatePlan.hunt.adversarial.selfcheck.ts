/**
 * Hunt-only adversarial attacks against AI plan / multi-zone.
 * Intentional FAIL set — do not "fix" production to green these.
 *
 * Run:
 *   node --import ./scripts/register-domain-selfcheck.mjs --experimental-strip-types ./src/lib/server/ai/generatePlan.hunt.adversarial.selfcheck.ts
 */
import {
	ensureHintCoverage,
	padToMinExercises,
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
import { matchTemplate } from './splitTemplates.ts';

const MIN_EXERCISES = 5;

type Attack = { id: string; run: () => void };
const attacks: Attack[] = [];

function attack(id: string, run: () => void) {
	attacks.push({ id, run });
}

function ex(id: string): AiPlan['exercises'][number] {
	return { exerciseId: id, sets: 3, reps: 10, restSec: 90 };
}

const index = loadExerciseIndex();
const allowed = catalogWhitelist(index);

/** EN singular «tricep» must map like «triceps» (zone + target). */
attack('hints.synonym-tricep-singular', () => {
	const brief = 'chest and tricep 45 min';
	const { parts } = hintsFromBrief(brief);
	const targets = targetsFromBrief(brief);
	if (!parts.includes('chest')) throw new Error(`precondition chest missing: ${JSON.stringify(parts)}`);
	if (!parts.includes('upper arms')) {
		throw new Error(`tricep synonym missed upper arms: ${JSON.stringify(parts)}`);
	}
	if (!targets.includes('triceps')) {
		throw new Error(`tricep synonym missed target: ${JSON.stringify(targets)}`);
	}
});

/** RU short «триц» should still vote upper arms / triceps. */
attack('hints.synonym-trits-ru-short', () => {
	const brief = 'спина и триц 1 час';
	const { parts } = hintsFromBrief(brief);
	const targets = targetsFromBrief(brief);
	if (!parts.includes('back')) throw new Error(`precondition back missing: ${JSON.stringify(parts)}`);
	if (!parts.includes('upper arms')) {
		throw new Error(`триц missed upper arms: ${JSON.stringify(parts)}`);
	}
	if (!targets.includes('triceps')) {
		throw new Error(`триц missed target: ${JSON.stringify(targets)}`);
	}
});

/**
 * Decimal hours: «0.5 часа» ≈ 30 мин → same band as «30 минут» (fallback / short).
 * Current regex captures «5 часа» → 8 exercises.
 */
attack('duration.half-hour-decimal-matches-30min', () => {
	const half = desiredExerciseCountFromBrief('тренировка 0.5 часа', MIN_EXERCISES);
	const thirty = desiredExerciseCountFromBrief('тренировка 30 минут', MIN_EXERCISES);
	if (half !== thirty) {
		throw new Error(`0.5 часа → ${half}, 30 минут → ${thirty} (want equal short-session band)`);
	}
});

/** NaN minCount must not bypass floor (treat as MIN_EXERCISES). */
attack('pad.nan-minCount-uses-floor', () => {
	const slim = index.filter((e) => e.body_part === 'chest').slice(0, 10);
	if (slim.length < MIN_EXERCISES) throw new Error('precondition: need ≥5 chest');
	const plan: AiPlan = { name: 'NaN', exercises: [ex(slim[0]!.id)] };
	const out = padToMinExercises(plan, slim, allowed, [], Number.NaN);
	if (out.exercises.length < MIN_EXERCISES) {
		throw new Error(`NaN minCount under-padded: ${out.exercises.length}`);
	}
	if (out.exercises.length > MIN_EXERCISES) {
		throw new Error(
			`NaN minCount should clamp to floor ${MIN_EXERCISES}, got ${out.exercises.length}`
		);
	}
});

/**
 * When slim under-serves triceps (only biceps in upper arms), coverage must still
 * pull a triceps id from the full index — not leave the wrong arm target.
 */
attack('cover.triceps-when-slim-only-biceps', () => {
	const brief = 'Спина и трицепс';
	const { parts } = hintsFromBrief(brief);
	const targets = targetsFromBrief(brief);
	if (!targets.includes('triceps')) throw new Error('precondition: want triceps target');

	const backs = index.filter((e) => e.body_part === 'back');
	const biceps = index.filter((e) => e.body_part === 'upper arms' && e.target === 'biceps');
	const tris = index.filter((e) => e.body_part === 'upper arms' && e.target === 'triceps');
	if (backs.length < 7 || !biceps.length || !tris.length) {
		throw new Error('precondition: need back + biceps + triceps in catalog');
	}

	let plan: AiPlan = {
		name: 'Спина и трицепс',
		exercises: [...backs.slice(0, 7).map((x) => ex(x.id)), ex(biceps[0]!.id)]
	};
	const slim = [...backs.slice(0, 20), ...biceps.slice(0, 10)];
	plan = ensureHintCoverage(plan, index, parts, slim, allowed, targets);

	const armTargets = plan.exercises
		.map((e) => index.find((x) => x.id === e.exerciseId))
		.filter((row) => row?.body_part === 'upper arms')
		.map((row) => row!.target);

	if (!armTargets.includes('triceps')) {
		throw new Error(`want triceps after cover, got arms=${armTargets.join(',') || 'none'}`);
	}
});

/**
 * Multi-zone contract: secondary zone needs 1–2 slots, not a single token swap
 * while primary keeps almost the whole plan.
 */
attack('cover.secondary-zone-at-least-two', () => {
	const brief = 'Спина и трицепс 1 час';
	const { parts } = hintsFromBrief(brief);
	const targets = targetsFromBrief(brief);
	const backs = index.filter((e) => e.body_part === 'back');
	const slim = slimCatalogForBrief(index, brief);
	let plan: AiPlan = {
		name: 'Спина',
		exercises: backs.slice(0, 7).map((x) => ex(x.id))
	};
	plan = padToMinExercises(
		plan,
		slim,
		allowed,
		[],
		desiredExerciseCountFromBrief(brief, MIN_EXERCISES)
	);
	plan = ensureHintCoverage(plan, index, parts, slim, allowed, targets);

	const arms = plan.exercises.filter((e) => {
		const row = index.find((x) => x.id === e.exerciseId);
		return row?.body_part === 'upper arms';
	}).length;
	if (arms < 2) {
		throw new Error(`secondary upper arms underserved: ${arms} (want ≥2)`);
	}
});

/**
 * Tied chest+back votes must not collapse to single-zone «chest» template
 * (loses back slots in the prompt reference).
 */
attack('template.chest-back-tie-not-single-chest', () => {
	const hintParts = ['chest', 'back'];
	const t = matchTemplate(['chest', 'back', 'chest', 'back'], hintParts);
	if (!t) throw new Error('expected a template');
	if (t.id === 'chest' || t.id === 'back') {
		throw new Error(`tied chest+back collapsed to single-zone ${t.id}`);
	}
	const coversBoth =
		t.triggerParts.includes('chest') && t.triggerParts.includes('back');
	if (!coversBoth) {
		throw new Error(`template ${t.id} triggers=${t.triggerParts.join(',')} miss chest+back`);
	}
});

/**
 * Empty catalog + multi-zone brief: must fail closed (throw), not return
 * an uncovered plan of unresolved ids.
 */
attack('cover.empty-catalog-fail-closed', () => {
	const parts = ['back', 'upper arms'];
	const plan: AiPlan = {
		name: 'Orphan',
		exercises: [ex('not-in-catalog'), ex('also-missing')]
	};
	let threw = false;
	try {
		ensureHintCoverage(plan, [], parts, [], new Set(), ['triceps']);
	} catch {
		threw = true;
	}
	if (!threw) {
		throw new Error('empty catalog left multi-zone plan uncovered without throw');
	}
});

let failed = 0;
const failing: string[] = [];
const passing: string[] = [];
for (const a of attacks) {
	try {
		a.run();
		passing.push(a.id);
		console.log(`PASS ${a.id}`);
	} catch (err) {
		failed += 1;
		failing.push(a.id);
		console.error(`FAIL ${a.id}: ${(err as Error).message}`);
	}
}

console.log(`\nhunt: ${passing.length}/${attacks.length} pass, ${failed} fail`);
if (failed === 0) {
	console.log(passing.join('\n'));
	process.exit(0);
}
console.error(failing.join('\n'));
process.exit(1);
