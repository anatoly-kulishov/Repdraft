/**
 * Parse/clamp + retrievePrescriptionContext (no network).
 *   node --import ./scripts/register-domain-selfcheck.mjs --experimental-strip-types ./src/lib/server/ai/tunePrescription.selfcheck.ts
 */
import { loadExerciseIndex } from './catalog.ts';
import {
	alignPrescriptionToGoal,
	findPeerExercises,
	goalBand,
	guessSlotRole,
	isTuneGoal,
	parsePrescriptionPayload,
	pickSlotForExercise,
	retrievePrescriptionContext
} from './tunePrescription.ts';

function assert(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new Error(msg);
}

{
	assert(isTuneGoal('hypertrophy'), 'hypertrophy is a goal');
	assert(!isTuneGoal('bulk'), 'bulk is not a goal');
}

{
	const p = parsePrescriptionPayload({
		sets: 99,
		reps: 1,
		restSec: 10,
		why: '  ok  '
	});
	assert(p.sets === 4, `sets clamp to general band high got ${p.sets}`);
	assert(p.reps === 8, `reps clamp to general band low got ${p.reps}`);
	assert(p.restSec === 60, `rest clamp to general band low got ${p.restSec}`);
	assert(p.why.includes('3×') === false, 'why uses clamped numbers');
	assert(p.why.includes('4×8'), `deterministic why got «${p.why}»`);
}

{
	const p = parsePrescriptionPayload(
		'```json\n{"sets":3,"reps":12,"restSec":60,"why":"лесенка от 5 до 1"}\n```',
		'en',
		'hypertrophy'
	);
	assert(p.sets === 3 && p.reps === 12 && p.restSec === 60, 'fence parse');
	assert(!p.why.includes('лесенка'), 'LLM why discarded');
	assert(p.why.includes('3×12'), `why from numbers got «${p.why}»`);
}

{
	const p = parsePrescriptionPayload(
		{ sets: 3, reps: 10, restSec: 90, why: 'nonsense ladder' },
		'ru',
		'hypertrophy'
	);
	assert(p.why.includes('3×10') && p.why.includes('рост'), `ru why «${p.why}»`);
}

{
	const raw = { sets: 4, reps: 8, restSec: 120, why: 'echo' };
	const end = parsePrescriptionPayload(raw, 'ru', 'endurance');
	const band = goalBand('endurance');
	assert(end.reps >= band.reps[0] && end.reps <= band.reps[1], `endurance reps ${end.reps}`);
	assert(
		end.restSec >= band.restSec[0] && end.restSec <= band.restSec[1],
		`endurance rest ${end.restSec}`
	);
	const str = alignPrescriptionToGoal(
		{ sets: 3, reps: 15, restSec: 45, why: 'x' },
		'strength'
	);
	assert(str.reps <= goalBand('strength').reps[1], `strength reps ${str.reps}`);
	assert(str.restSec >= goalBand('strength').restSec[0], `strength rest ${str.restSec}`);
}

const index = loadExerciseIndex();
assert(index.length > 10, 'catalog index loaded');

const sample =
	index.find((e) => e.body_part === 'upper arms') ??
	index.find((e) => e.body_part === 'back') ??
	index[0]!;

{
	const role = guessSlotRole(sample);
	assert(
		role === 'heavy_compound' || role === 'compound' || role === 'isolation',
		`role ${role}`
	);
	const slot = pickSlotForExercise(sample);
	assert(slot, 'pickSlotForExercise returns a slot for sample');
}

{
	const ctx = retrievePrescriptionContext(sample.id, index);
	assert(ctx, 'retrievePrescriptionContext');
	assert(ctx!.exercise.id === sample.id, 'context exercise id');
	assert(ctx!.slot, 'context has slot');
	assert(ctx!.mode === 'hybrid' || ctx!.mode === 'template', `mode ${ctx!.mode}`);
}

{
	const peers = findPeerExercises(sample.id, index, 3);
	assert(Array.isArray(peers), 'peers array');
	assert(peers.every((p) => p.id !== sample.id), 'peers exclude self');
	assert(peers.length <= 3, 'peers capped');
}

{
	const missing = retrievePrescriptionContext('__no_such_exercise__', index);
	assert(missing === null, 'unknown id → null');
}

console.log('tunePrescription.selfcheck: ok');
