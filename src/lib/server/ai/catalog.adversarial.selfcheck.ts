/**
 * Confirmed adversarial fixes for slimCatalogForBrief — must stay green.
 *
 * Run:
 *   node --import ./scripts/register-domain-selfcheck.mjs --experimental-strip-types ./src/lib/server/ai/catalog.adversarial.selfcheck.ts
 */
import {
	hintsFromBrief,
	loadExerciseIndex,
	slimCatalogForBrief
} from './catalog.ts';

const MIN_EXERCISES = 5;

type Attack = { id: string; run: () => void };
const attacks: Attack[] = [];

function attack(id: string, run: () => void) {
	attacks.push({ id, run });
}

const index = loadExerciseIndex();

/** Zone+equipment: stay inside zone (may be < MIN when catalog zone is tiny). */
attack('slim.and-impossible-falls-back', () => {
	const brief = 'шея штанга';
	const hints = hintsFromBrief(brief);
	if (!hints.parts.includes('neck') || !hints.equipment.includes('barbell')) {
		throw new Error(`precondition hints: ${JSON.stringify(hints)}`);
	}
	const slim = slimCatalogForBrief(index, brief);
	if (!slim.length) throw new Error('slim empty for neck');
	const leaked = slim.filter((ex) => ex.body_part !== 'neck');
	if (leaked.length) {
		throw new Error(`neck brief leaked foreign zones: ${leaked.map((x) => x.body_part).join(',')}`);
	}
});

attack('slim.cardio-barbell-falls-back', () => {
	const slim = slimCatalogForBrief(index, 'кардио штанга');
	if (!slim.length) throw new Error('slim empty for cardio');
	const leaked = slim.filter((ex) => ex.body_part !== 'cardio');
	if (leaked.length) {
		throw new Error(`cardio brief leaked: ${leaked.map((x) => x.body_part).join(',')}`);
	}
});

/** Empty index stays empty (no invent). */
attack('slim.empty-index-stays-empty', () => {
	const slim = slimCatalogForBrief([], 'грудь штанга');
	if (slim.length !== 0) throw new Error(`expected [], got ${slim.length}`);
});

/** «руки» must map to upper arms — otherwise topPopular leaks squats into arm plans. */
attack('hints.arms-ru-maps-upper-arms', () => {
	const hints = hintsFromBrief('Хочу руки подкачать');
	if (!hints.parts.includes('upper arms') || hints.parts.includes('upper legs')) {
		throw new Error(`unexpected parts: ${JSON.stringify(hints.parts)}`);
	}
	const slim = slimCatalogForBrief(index, 'Хочу руки подкачать');
	const leaked = slim.filter((ex) => ex.body_part === 'upper legs' || ex.target === 'glutes');
	if (leaked.length) {
		throw new Error(`legs/glutes in arms slim: ${leaked.slice(0, 3).map((x) => x.id).join(',')}`);
	}
	if (slim.length < MIN_EXERCISES) {
		throw new Error(`arms slim too short: ${slim.length}`);
	}
});

attack('hints.arms-en-maps-upper-arms', () => {
	const hints = hintsFromBrief('pump arms 40 min');
	if (!hints.parts.includes('upper arms')) {
		throw new Error(`expected upper arms, got ${JSON.stringify(hints.parts)}`);
	}
});

let failed = 0;
const failing: string[] = [];
for (const a of attacks) {
	try {
		a.run();
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
