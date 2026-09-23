/**
 * User-scenario coverage for Builder AI tune (offline + optional live GigaChat).
 *
 * Run:
 *   node --import ./scripts/register-domain-selfcheck.mjs --experimental-strip-types ./src/lib/server/ai/tunePrescription.usage.selfcheck.ts
 */
import { nextGoalNote } from '$lib/domain/aiTuneGoalNote';
import {
	addExercise,
	buildLadderScheme,
	createEmptyDraft,
	hasLadderScheme,
	updateExercise
} from '$lib/domain/workout';
import { resolveAiConfig } from './config.ts';
import { loadExerciseIndex } from './catalog.ts';
import {
	goalBand,
	parsePrescriptionPayload,
	tunePrescription,
	type TuneGoal,
	whyForPrescription
} from './tunePrescription.ts';
import { POST } from '../../../routes/api/ai/tune/+server.ts';

function assert(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new Error(msg);
}

const GOALS: TuneGoal[] = ['strength', 'hypertrophy', 'endurance', 'general'];

type Case = { id: string; run: () => void | Promise<void> };
const cases: Case[] = [];
function scenario(id: string, run: () => void | Promise<void>) {
	cases.push({ id, run });
}

async function postTune(body: unknown) {
	const req = new Request('http://localhost/api/ai/tune', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
	const res = await POST({ request: req } as Parameters<typeof POST>[0]);
	return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

function inBand(n: number, band: [number, number]): boolean {
	return n >= band[0] && n <= band[1];
}

/** Offline: every goal band + why stays consistent with numbers. */
scenario('offline.all-goals-band-and-why', () => {
	for (const goal of GOALS) {
		const band = goalBand(goal);
		const raw = {
			sets: band.sets[0],
			reps: band.reps[0],
			restSec: band.restSec[0],
			why: 'ignored ladder 5→1'
		};
		const p = parsePrescriptionPayload(raw, 'ru', goal);
		assert(inBand(p.sets, band.sets), `${goal} sets ${p.sets}`);
		assert(inBand(p.reps, band.reps), `${goal} reps ${p.reps}`);
		assert(inBand(p.restSec, band.restSec), `${goal} rest ${p.restSec}`);
		assert(
			p.why === whyForPrescription(p, goal, 'ru'),
			`${goal} why mismatch «${p.why}»`
		);
		assert(!/лесенк|ladder|1ПМ|разовый/i.test(p.why), `${goal} why noise «${p.why}»`);
	}
});

/** Offline: out-of-band LLM output forced into goal. */
scenario('offline.force-endurance-from-strength-shaped', () => {
	const p = parsePrescriptionPayload(
		{ sets: 4, reps: 5, restSec: 180 },
		'ru',
		'endurance'
	);
	const b = goalBand('endurance');
	assert(inBand(p.reps, b.reps), `reps ${p.reps}`);
	assert(inBand(p.restSec, b.restSec), `rest ${p.restSec}`);
});

/** Note chips: swap templates, keep custom text. */
scenario('ui.goal-note-swap-and-preserve-custom', () => {
	const templates = [
		'Меньше повторов, длиннее отдых между подходами.',
		'Средние повторы и умеренный отдых для роста мышц.',
		'Больше повторов, короче отдых.',
		'Сбалансированная нагрузка без уклона в силу или выносливость.'
	] as const;
	assert(
		nextGoalNote(templates[1], templates[0], templates) === templates[0],
		'swap hypertrophy→strength template'
	);
	assert(
		nextGoalNote('  ', templates[2], templates) === templates[2],
		'empty → fill'
	);
	const custom = 'Без паузы внизу';
	assert(
		nextGoalNote(custom, templates[0], templates) === custom,
		'custom note must survive chip change'
	);
});

/** Apply path: sets/reps patch clears active ladder (menu coexistence). */
scenario('apply.clears-ladder-scheme', () => {
	let plan = createEmptyDraft('Tune');
	plan = addExercise(plan, 'ex-squat').plan;
	plan = updateExercise(plan, 'ex-squat', { repsScheme: buildLadderScheme(5, 1) });
	assert(hasLadderScheme(plan.exercises[0]!), 'ladder on');
	plan = updateExercise(plan, 'ex-squat', { sets: 3, reps: 10, restSec: 90 });
	const ex = plan.exercises[0]!;
	assert(!hasLadderScheme(ex), 'AI apply must clear ladder');
	assert(ex.sets === 3 && ex.reps === 10 && ex.restSec === 90, 'numbers applied');
});

/** Apply path: only numbers (sheet note is not written to exercise). */
scenario('apply.numbers-only-no-exercise-note', () => {
	let plan = createEmptyDraft('Tune');
	plan = addExercise(plan, 'ex-a').plan;
	plan = updateExercise(plan, 'ex-a', { sets: 4, reps: 6, restSec: 150 });
	const ex = plan.exercises[0]!;
	assert(ex.sets === 4 && ex.reps === 6 && ex.restSec === 150, 'patched');
	assert(!('note' in ex && (ex as { note?: string }).note), 'no note field from tune apply');
});

/** API: missing / unknown id. */
scenario('api.invalid-inputs', async () => {
	const missing = await postTune({ goal: 'hypertrophy' });
	assert(missing.status === 400, `missing id ${missing.status}`);
	const unknown = await postTune({ exerciseId: '__no_such__', goal: 'strength' });
	assert(unknown.status === 400 && unknown.json.code === 'invalid_input', 'unknown id');
});

/** Live: each goal × compound + isolation stays in band (skip if no AI). */
scenario('live.goals-x-roles-in-band', async () => {
	if (!resolveAiConfig()) {
		console.log('SKIP live.goals-x-roles-in-band (AI not configured)');
		return;
	}
	const index = loadExerciseIndex();
	const squat =
		index.find((e) => /barbell.*squat|squat.*barbell/i.test(e.name) && e.body_part === 'upper legs') ??
		index.find((e) => e.body_part === 'upper legs' && /barbell/i.test(e.equipment)) ??
		index[0]!;
	const curl =
		index.find((e) => /curl/i.test(e.name) && e.body_part === 'upper arms') ??
		index.find((e) => e.body_part === 'upper arms') ??
		index[0]!;

	// One compound + one isolation × all goals (8 live calls).
	const targets = [
		{ id: squat.id, role: 'compound' },
		{ id: curl.id, role: 'isolation' }
	];
	for (const t of targets) {
		for (const goal of GOALS) {
			const r = await tunePrescription({
				exerciseId: t.id,
				goal,
				lang: 'ru',
				sets: 3,
				reps: 10,
				restSec: 90,
				note: goal === 'endurance' ? 'Больше повторов, короче отдых.' : undefined
			});
			assert(r.ok, `${t.role}/${goal} failed: ${!r.ok ? r.error : ''}`);
			if (!r.ok) continue;
			const b = goalBand(goal);
			const p = r.prescription;
			assert(inBand(p.sets, b.sets), `${goal} sets ${p.sets} band ${b.sets}`);
			assert(inBand(p.reps, b.reps), `${goal} reps ${p.reps} band ${b.reps}`);
			assert(inBand(p.restSec, b.restSec), `${goal} rest ${p.restSec} band ${b.restSec}`);
			assert(
				p.why.includes(`${p.sets}×${p.reps}`),
				`${goal} why «${p.why}» must echo numbers`
			);
			console.log(`  live ${t.role} ${goal} → ${p.sets}×${p.reps}·${p.restSec}s`);
		}
	}
});

/** Live refine: prior + note still lands in band. */
scenario('live.refine-stays-in-band', async () => {
	if (!resolveAiConfig()) {
		console.log('SKIP live.refine-stays-in-band (AI not configured)');
		return;
	}
	const index = loadExerciseIndex();
	const ex = index.find((e) => e.body_part === 'chest') ?? index[0]!;
	const first = await tunePrescription({
		exerciseId: ex.id,
		goal: 'hypertrophy',
		lang: 'ru',
		sets: 3,
		reps: 10,
		restSec: 90
	});
	assert(first.ok, `first: ${!first.ok ? first.error : ''}`);
	if (!first.ok) return;
	const second = await tunePrescription({
		exerciseId: ex.id,
		goal: 'hypertrophy',
		lang: 'ru',
		sets: 3,
		reps: 10,
		restSec: 90,
		note: 'Чуть короче отдых',
		prior: {
			sets: first.prescription.sets,
			reps: first.prescription.reps,
			restSec: first.prescription.restSec,
			why: first.prescription.why
		}
	});
	assert(second.ok, `refine: ${!second.ok ? second.error : ''}`);
	if (!second.ok) return;
	const b = goalBand('hypertrophy');
	const p = second.prescription;
	assert(inBand(p.sets, b.sets) && inBand(p.reps, b.reps) && inBand(p.restSec, b.restSec), 'refine band');
	console.log(`  refine → ${p.sets}×${p.reps}·${p.restSec}s «${p.why}»`);
});

let failed = 0;
for (const c of cases) {
	try {
		await c.run();
		console.log(`ok ${c.id}`);
	} catch (e) {
		failed += 1;
		console.error(`FAIL ${c.id}: ${e instanceof Error ? e.message : String(e)}`);
	}
}

if (failed > 0) {
	throw new Error(`tunePrescription.usage.selfcheck: ${failed}/${cases.length} failed`);
}
console.log(`tunePrescription.usage.selfcheck: ${cases.length}/${cases.length} ok`);
