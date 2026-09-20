/**
 * Adversarial regression: AI Draft zone / slang / pad invariants.
 *
 * Run:
 *   node --import ./scripts/register-domain-selfcheck.mjs --experimental-strip-types ./src/lib/server/ai/aiDraft.adversarial.selfcheck.ts
 */
import { sanitizeAiBrief } from '../../domain/inputLimits.ts';
import {
	catalogWhitelist,
	hintsFromBrief,
	loadExerciseIndex,
	slimCatalogForBrief
} from './catalog.ts';
import {
	filterToBodyHints,
	padToMinExercises,
	type AiPlan
} from './generatePlan.ts';
import { retrieveRegexOnly } from './retrieve.ts';

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

/** Contract #6: slang «булки» → glutes / upper legs. */
attack('hints.bulki-maps-legs', () => {
	const h = hintsFromBrief('накачать булки');
	if (!h.parts.includes('upper legs')) {
		throw new Error(`expected upper legs for «булки», got ${JSON.stringify(h.parts)}`);
	}
});

/** «булки» with empty hints → fullbody / topPopular, not legs. */
attack('retrieve.bulki-not-fullbody', () => {
	const r = retrieveRegexOnly('булки', index);
	if (r.template?.id === 'fullbody' || !r.template) {
		throw new Error(`«булки» template=${r.template?.id ?? 'null'}, want legs|lower`);
	}
	const leaked = r.exercises.filter((e) => e.body_part === 'chest' || e.body_part === 'back');
	if (leaked.length > r.exercises.length * 0.3) {
		throw new Error(`«булки» retrieve flooded with chest/back: ${leaked.length}/${r.exercises.length}`);
	}
});

/** «предплечье» contains «плеч» → false shoulders vote. */
attack('hints.predplechie-no-shoulders', () => {
	const h = hintsFromBrief('предплечье');
	if (h.parts.includes('shoulders')) {
		throw new Error(`«предплечье» falsely mapped shoulders: ${JSON.stringify(h.parts)}`);
	}
});

/** English substring «back» in feedback → false back zone. */
attack('hints.feedback-no-back', () => {
	const h = hintsFromBrief('feedback for form');
	if (h.parts.includes('back')) {
		throw new Error(`«feedback» falsely mapped back: ${JSON.stringify(h.parts)}`);
	}
});

/** English substring «leg» in college/allegro/leggings. */
attack('hints.college-no-legs', () => {
	const h = hintsFromBrief('college gym');
	if (h.parts.includes('upper legs')) {
		throw new Error(`«college» falsely mapped legs: ${JSON.stringify(h.parts)}`);
	}
});

/** RDL / румынская тяга is a leg hinge; «тяга» alone forces back. */
attack('hints.romanian-deadlift-not-pure-back', () => {
	const h = hintsFromBrief('румынская тяга');
	if (h.parts.includes('back') && !h.parts.includes('upper legs')) {
		throw new Error(`RDL mapped pure back, no legs: ${JSON.stringify(h.parts)}`);
	}
});

attack('hints.mertvaya-tyaga-not-pure-back', () => {
	const h = hintsFromBrief('мертвая тяга');
	if (h.parts.includes('back') && !h.parts.includes('upper legs')) {
		throw new Error(`мертвая тяга mapped pure back: ${JSON.stringify(h.parts)}`);
	}
});

/**
 * OR-fallback on zone+equipment: slim mixes foreign body_parts.
 * Then pad (after filterToBodyHints) reintroduces them into the plan.
 */
attack('pipeline.or-pad-reintroduces-foreign-zone', () => {
	const brief = 'шея штанга';
	const { parts } = hintsFromBrief(brief);
	if (!parts.includes('neck')) throw new Error(`precondition: want neck, got ${JSON.stringify(parts)}`);
	const slim = slimCatalogForBrief(index, brief);
	const neck = index.filter((e) => e.body_part === 'neck');
	if (neck.length < 1) throw new Error('precondition: need neck in index');
	let plan: AiPlan = {
		name: 'Шея',
		exercises: neck.slice(0, 2).map((e) => ex(e.id))
	};
	plan = filterToBodyHints(plan, index, parts);
	plan = padToMinExercises(plan, slim, allowed, parts.length ? [] : index);
	const foreign = plan.exercises.filter((row) => {
		const item = index.find((x) => x.id === row.exerciseId);
		return item != null && !parts.includes(item.body_part);
	});
	if (foreign.length) {
		throw new Error(
			`pad reintroduced foreign zones: ${foreign
				.map((f) => {
					const item = index.find((x) => x.id === f.exerciseId);
					return `${f.exerciseId}:${item?.body_part}`;
				})
				.join(', ')}`
		);
	}
});

/** Same OR+pad leak for arms + kettlebell. */
attack('pipeline.arms-kettlebell-pad-leaks', () => {
	const brief = 'руки kettlebell';
	const { parts } = hintsFromBrief(brief);
	const slim = slimCatalogForBrief(index, brief);
	const arms = slim.filter((e) => e.body_part === 'upper arms').slice(0, 2);
	if (arms.length < 2) throw new Error('precondition: need ≥2 arms in slim');
	let plan: AiPlan = { name: 'Руки', exercises: arms.map((e) => ex(e.id)) };
	plan = filterToBodyHints(plan, index, parts);
	plan = padToMinExercises(plan, slim, allowed, parts.length ? [] : index);
	const foreign = plan.exercises.filter((row) => {
		const item = index.find((x) => x.id === row.exerciseId);
		return item != null && !parts.includes(item.body_part);
	});
	if (foreign.length) {
		throw new Error(
			`arms+kettlebell pad leaked: ${foreign
				.map((f) => index.find((x) => x.id === f.exerciseId)?.body_part)
				.join(',')}`
		);
	}
});

/** Overlong brief: zone word past 500-char slice is dropped → untargeted. */
attack('brief.overlong-truncates-trailing-zone', () => {
	const briefRaw = 'a'.repeat(500) + 'ноги';
	const brief = sanitizeAiBrief(briefRaw);
	const h = hintsFromBrief(brief);
	// Contract: trailing zone intent must survive sanitize.
	if (!brief.includes('ноги') || !h.parts.includes('upper legs')) {
		throw new Error(
			`overlong sanitize dropped trailing «ноги» (len=${brief.length}, parts=${JSON.stringify(h.parts)})`
		);
	}
});

/** «булки» must keep pad inside legs (no full-index fallback). */
attack('pipeline.bulki-pad-uses-full-index', () => {
	const brief = 'булки';
	const { parts } = hintsFromBrief(brief);
	if (!parts.includes('upper legs')) {
		throw new Error(`precondition: булки→legs, got ${JSON.stringify(parts)}`);
	}
	const slim = slimCatalogForBrief(index, brief).filter((e) => parts.includes(e.body_part));
	const seed = slim[0];
	if (!seed) throw new Error('precondition: legs in slim');
	let plan: AiPlan = { name: 'Булки', exercises: [ex(seed.id)] };
	plan = filterToBodyHints(plan, index, parts);
	plan = padToMinExercises(plan, slim, allowed, []);
	const hasNonLegs = plan.exercises.some((row) => {
		const item = index.find((x) => x.id === row.exerciseId);
		return item != null && item.body_part !== 'upper legs' && item.body_part !== 'lower legs';
	});
	if (hasNonLegs) {
		throw new Error(
			`«булки» pad leaked non-leg parts: ${plan.exercises
				.map((r) => index.find((x) => x.id === r.exerciseId)?.body_part)
				.join(',')}`
		);
	}
});

/** предплечье filter allows shoulders into the plan. */
attack('pipeline.predplechie-allows-shoulders', () => {
	const { parts } = hintsFromBrief('предплечье');
	const shoulder = index.find((e) => e.body_part === 'shoulders');
	const forearm = index.find((e) => e.body_part === 'lower arms');
	if (!shoulder || !forearm) throw new Error('precondition');
	const plan = filterToBodyHints(
		{
			name: 'Предплечье',
			exercises: [ex(shoulder.id), ex(forearm.id), ex(shoulder.id)]
		},
		index,
		parts
	);
	if (plan.exercises.some((e) => e.exerciseId === shoulder.id)) {
		throw new Error('shoulder id survived filter for «предплечье» brief');
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
