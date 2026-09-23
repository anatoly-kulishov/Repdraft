/**
 * Confirmed adversarial fixes for Builder AI tune — must stay green.
 *
 * Run:
 *   node --import ./scripts/register-domain-selfcheck.mjs --experimental-strip-types ./src/lib/server/ai/tunePrescription.adversarial.selfcheck.ts
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadExerciseIndex } from './catalog.ts';
import {
	alignPrescriptionToGoal,
	clampTuneAbsolute,
	goalBand,
	guessSlotRole,
	parsePrescriptionPayload,
	tunePrescription,
	whyForPrescription,
	type TuneGoal
} from './tunePrescription.ts';
import { POST } from '../../../routes/api/ai/tune/+server.ts';

const tuneServerPath = fileURLToPath(
	new URL('../../../routes/api/ai/tune/+server.ts', import.meta.url)
);

function assert(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new Error(msg);
}

type Attack = { id: string; run: () => void | Promise<void> };
const attacks: Attack[] = [];
function attack(id: string, run: () => void | Promise<void>) {
	attacks.push({ id, run });
}

async function postTune(body: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
	const req = new Request('http://localhost/api/ai/tune', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: typeof body === 'string' ? body : JSON.stringify(body)
	});
	const res = await POST({ request: req } as Parameters<typeof POST>[0]);
	return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

attack('align.stale-why-contradicts-clamped-numbers', () => {
	const before = {
		sets: 3,
		reps: 15,
		restSec: 45,
		why: whyForPrescription({ sets: 3, reps: 15, restSec: 45 }, 'endurance', 'ru')
	};
	const after = alignPrescriptionToGoal(before, 'strength', 'ru');
	const band = goalBand('strength');
	assert(after.reps >= band.reps[0] && after.reps <= band.reps[1], 'reps in strength band');
	assert(
		after.why.includes(`${after.sets}×${after.reps}`),
		`why must match clamped nums; got «${after.why}»`
	);
	assert(!after.why.includes('3×15'), `stale endurance why leaked: «${after.why}»`);
});

attack('parse.fence-trailing-prose-should-recover', () => {
	const raw =
		'```json\n{"sets":3,"reps":10,"restSec":90}\n```\nNote: лесенка 5→1 is better';
	const p = parsePrescriptionPayload(raw, 'ru', 'general');
	assert(p.sets === 3 && p.reps === 10 && p.restSec === 90, `got ${p.sets}×${p.reps}×${p.restSec}`);
	assert(!p.why.includes('лесенка'), 'deterministic why must drop ladder prose');
});

attack('parse.array-payload-must-reject', () => {
	let threw = false;
	try {
		parsePrescriptionPayload([3, 10, 90], 'ru', 'general');
	} catch {
		threw = true;
	}
	assert(threw, 'array payload must throw');
});

attack('parse.json-array-string-must-reject', () => {
	let threw = false;
	try {
		parsePrescriptionPayload('[3,10,90]', 'ru', 'hypertrophy');
	} catch {
		threw = true;
	}
	assert(threw, 'JSON array string must throw');
});

attack('api.unknown-exerciseId-not-unavailable', async () => {
	const r = await postTune({ exerciseId: '__no_such_exercise__', goal: 'hypertrophy' });
	assert(
		r.json.code === 'invalid_input',
		`unknown id must be invalid_input, got status=${r.status} code=${String(r.json.code)} error=${String(r.json.error)}`
	);
	assert(r.status === 400, `unknown id status 400, got ${r.status}`);
});

attack('tune.unknown-id-before-availability', async () => {
	const r = await tunePrescription({ exerciseId: '__no_such_exercise__' });
	assert(!r.ok, 'must fail');
	assert(
		r.code === 'invalid_input',
		`unknown id must be invalid_input, got ${r.code}: ${r.error}`
	);
});

/** Guest AI is intentional (same as /api/ai/plan). Guard: prior must be clamped. */
attack('api.parsePrior-clamped', () => {
	const src = readFileSync(tuneServerPath, 'utf8');
	assert(/clampTuneAbsolute/.test(src), 'parsePrior must use clampTuneAbsolute');
	const crazy = clampTuneAbsolute(999, 1, -50);
	assert(crazy.sets <= 5 && crazy.sets >= 2, `sets ${crazy.sets}`);
	assert(crazy.reps >= 5, `reps ${crazy.reps}`);
	assert(crazy.restSec >= 30, `rest ${crazy.restSec}`);
});

attack('role.pulldown-not-isolation', () => {
	const index = loadExerciseIndex();
	const lat =
		index.find(
			(e) =>
				e.body_part === 'back' &&
				/pulldown/i.test(e.name) &&
				!/straight.?arm|pushdown/i.test(e.name)
		) ?? null;
	assert(lat, 'need a back pulldown in catalog');
	const role = guessSlotRole(lat!);
	assert(
		role === 'compound' || role === 'heavy_compound',
		`pulldown «${lat!.name}» must be compound, got ${role}`
	);
});

attack('goal.invalid-fallback-not-throw', () => {
	const bogus = 'bulk' as TuneGoal;
	const p = parsePrescriptionPayload({ sets: 3, reps: 10, restSec: 90 }, 'ru', bogus);
	assert(p.sets === 3 && p.reps === 10 && p.restSec === 90, 'falls back to general band');
	assert(p.why.includes('3×10'), `why «${p.why}»`);
});

let failed = 0;
for (const a of attacks) {
	try {
		await a.run();
		console.log(`ok ${a.id}`);
	} catch (e) {
		failed += 1;
		const msg = e instanceof Error ? e.message : String(e);
		console.error(`FAIL ${a.id}: ${msg}`);
	}
}

if (failed > 0) {
	throw new Error(`tunePrescription.adversarial.selfcheck: ${failed}/${attacks.length} failed`);
}
console.log(`tunePrescription.adversarial.selfcheck: ${attacks.length}/${attacks.length} ok`);
