/**
 * Confirmed adversarial fixes — must stay green.
 *
 * Run:
 *   node --import ./scripts/register-domain-selfcheck.mjs --experimental-strip-types ./src/lib/domain/workout.adversarial.selfcheck.ts
 */
import {
	advanceHomeNextPlanId,
	moveOrderIds,
	promotePlanToFront,
	rotatePlanToEnd,
	sortPlansByUserOrder,
	storageIndexForDropOntoNext,
	suggestNextPlan,
	syncPlanOrderIds,
	createEmptyDraft,
	addExercise,
	formSuperset,
	updateGroupSets,
	updateExercise
} from './workout.ts';
import {
	SETS,
	clampNote,
	clampPlanName,
	NOTE_MAX,
	PLAN_NAME_MAX
} from './inputLimits.ts';
import { finishSession, startSessionFromPlan, skipSessionExercise } from './session.ts';

type Attack = { id: string; run: () => void };
const attacks: Attack[] = [];

function attack(id: string, run: () => void) {
	attacks.push({ id, run });
}

/** Mirrors workouts/+page.svelte reorderPlan (incl. drop onto Next). */
function reorderViaDisplayIds(
	storageOrder: string[],
	displayPlans: { id: string }[],
	nextPlanId: string | undefined,
	fromVisual: number,
	toVisual: number
): string[] {
	const fromId = displayPlans[fromVisual]?.id;
	const toId = displayPlans[toVisual]?.id;
	if (!fromId || !toId || fromId === nextPlanId) return [...storageOrder];
	const fromOrder = storageOrder.indexOf(fromId);
	if (fromOrder < 0) return [...storageOrder];
	const toOrder =
		nextPlanId && toId === nextPlanId
			? storageIndexForDropOntoNext(storageOrder, nextPlanId)
			: storageOrder.indexOf(toId);
	if (toOrder < 0 || fromOrder === toOrder) return [...storageOrder];
	return moveOrderIds(storageOrder, fromOrder, toOrder);
}

attack('next.multi-finish-rotates-full-queue', () => {
	let plans = [
		{ id: 'solo' },
		{ id: 'pair' },
		{ id: 'hyper' },
		{ id: 'split' }
	];
	let pin: string | null = 'hyper';
	pin = advanceHomeNextPlanId(plans, 'hyper', pin);
	plans = rotatePlanToEnd(plans, 'hyper');
	if (pin !== 'solo') throw new Error(`after hyper pin=${pin}`);

	pin = advanceHomeNextPlanId(plans, 'solo', pin);
	plans = rotatePlanToEnd(plans, 'solo');
	if (pin !== 'pair') throw new Error(`after solo pin=${pin}`);

	pin = advanceHomeNextPlanId(plans, 'pair', pin);
	plans = rotatePlanToEnd(plans, 'pair');
	if (pin !== 'split') throw new Error(`after pair expected split, got ${pin}`);

	pin = advanceHomeNextPlanId(plans, 'split', pin);
	if (pin !== 'hyper') throw new Error(`after split expected hyper, got ${pin}`);
});

attack('dnd.drop-onto-promoted-next-under', () => {
	const storage = ['solo', 'pair', 'hyper', 'split'];
	const plans = storage.map((id) => ({ id }));
	const nextId = 'hyper';
	const display = promotePlanToFront(plans, nextId);
	const ns = reorderViaDisplayIds(storage, display, nextId, 3, 0);
	const after = promotePlanToFront(sortPlansByUserOrder(plans, ns), nextId).map((p) => p.id);
	if (after[1] !== 'split') {
		throw new Error(`want split under Next after drop, got ${after.join(',')}`);
	}
});

attack('dnd.drop-pair-onto-promoted-under', () => {
	const storage = ['solo', 'pair', 'hyper', 'split'];
	const plans = storage.map((id) => ({ id }));
	const nextId = 'hyper';
	const display = promotePlanToFront(plans, nextId);
	const ns = reorderViaDisplayIds(storage, display, nextId, 2, 0);
	const nd = promotePlanToFront(sortPlansByUserOrder(plans, ns), nextId).map((p) => p.id);
	if (nd[1] !== 'pair') {
		throw new Error(`want pair under Next after drop, got ${nd.join(',')}`);
	}
});

attack('clamp.group-sets-uses-sets-max', () => {
	let plan = createEmptyDraft('G');
	plan = addExercise(plan, 'a').plan;
	plan = addExercise(plan, 'b').plan;
	plan = formSuperset(plan, ['a', 'b']);
	const gid = plan.exercises[0]!.groupId!;
	plan = updateGroupSets(plan, gid, SETS.max);
	if (plan.exercises[0]!.sets !== SETS.max) {
		throw new Error(`updateGroupSets got ${plan.exercises[0]!.sets}, want ${SETS.max}`);
	}
	let solo = createEmptyDraft('S');
	solo = addExercise(solo, 'x').plan;
	solo = updateExercise(solo, 'x', { sets: SETS.max });
	if (solo.exercises[0]!.sets !== SETS.max) {
		throw new Error(`solo path broken: ${solo.exercises[0]!.sets}`);
	}
});

attack('clamp.note-no-mid-surrogate', () => {
	const loneHigh = '🔥'.slice(0, 1);
	if ((loneHigh.charCodeAt(0) & 0xfc00) !== 0xd800) {
		throw new Error('setup: expected lone high surrogate from UTF-16 slice');
	}
	const clamped = clampNote('🔥'.repeat(NOTE_MAX + 2));
	if ([...clamped].length !== NOTE_MAX) {
		throw new Error(`clampNote code points ${[...clamped].length} want ${NOTE_MAX}`);
	}
	if ([...clamped].join('') !== clamped) {
		throw new Error('clampNote left unpaired surrogates');
	}
});

attack('clamp.plan-name-no-mid-surrogate', () => {
	const raw = '🔥'.repeat(40);
	const c = clampPlanName(raw);
	if ([...c].length > PLAN_NAME_MAX) {
		throw new Error(`clampPlanName code-point oversize ${[...c].length}`);
	}
	if ([...c].join('') !== c) {
		throw new Error('clampPlanName left unpaired surrogates');
	}
});

attack('order.sync-dedupes', () => {
	const out = syncPlanOrderIds(['a', 'a', 'b'], ['a', 'b', 'c']);
	if (out.join(',') !== 'a,b,c') {
		throw new Error(`syncPlanOrderIds expected a,b,c got ${out.join(',')}`);
	}
});

attack('finish.skip-all-yields-empty-exercises', () => {
	let plan = createEmptyDraft('Named Plan');
	plan = addExercise(plan, 'a').plan;
	plan = addExercise(plan, 'b').plan;
	let s = startSessionFromPlan(plan);
	s = skipSessionExercise(s, 0);
	s = skipSessionExercise(s, 0);
	const done = finishSession(s);
	if (done.exercises.length !== 0) {
		throw new Error(`expected 0 exercises after skip-all finish, got ${done.exercises.length}`);
	}
	// live.finish must not persist this; domain only proves the empty shape.
});

attack('next.resolve-without-pin-goes-forward', () => {
	const plans = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
	const next = suggestNextPlan(plans, 'b')?.id;
	if (next !== 'c') {
		throw new Error(`suggestNextPlan(last=b) want c, got ${next}`);
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
