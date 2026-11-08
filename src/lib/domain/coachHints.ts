import type { ExerciseIndexItem } from './types';
import type { WorkoutSession } from './types';
import {
	finishedSessionsWithinDays,
	mergeSetMaps,
	pickCatalogExerciseForBodyPart,
	sessionSetsByBodyPart,
	setShares,
	undertrainedBodyParts
} from './trainingLoad';

export type CoachHint = {
	id: string;
	bodyPart: string;
	exerciseId: string;
	reasonKey: 'coach.hintLagging';
	/** Share of 30-day working sets on this body part, % (rounded). */
	sharePct: number;
};

export type CoachHintOptions = {
	now?: Date;
	/** Exercises already in any plan - never suggest them again. */
	planExerciseIds?: readonly string[];
	/** Body parts already covered by a replace card - skip duplicate Add. */
	excludeBodyParts?: ReadonlySet<string>;
};

/** Local (device) storage keys for coach hints. */
export const COACH_HIDDEN_KEY = 'repdraft:coach-hidden';
export const COACH_SEEN_KEY = 'repdraft:coach-seen';
/** "Hide for a week" window. */
export const COACH_HIDE_MS = 7 * 86_400_000;

/** bodyPart -> epoch ms until which the hint stays hidden. */
export type CoachHiddenMap = Record<string, number>;

export function parseCoachHidden(
	raw: string | null | undefined,
	nowMs: number = Date.now()
): CoachHiddenMap {
	if (!raw) return {};
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return {};
	}
	if (!parsed || typeof parsed !== 'object') return {};
	const map: CoachHiddenMap = {};
	for (const [bodyPart, until] of Object.entries(parsed as Record<string, unknown>)) {
		if (typeof until === 'number' && Number.isFinite(until) && until > nowMs) {
			map[bodyPart] = until;
		}
	}
	return map;
}

export function hideCoachPart(
	map: CoachHiddenMap,
	bodyPart: string,
	nowMs: number = Date.now()
): CoachHiddenMap {
	return { ...map, [bodyPart]: nowMs + COACH_HIDE_MS };
}

export function unhideCoachPart(map: CoachHiddenMap, bodyPart: string): CoachHiddenMap {
	const next = { ...map };
	delete next[bodyPart];
	return next;
}

export function isCoachPartHidden(
	map: CoachHiddenMap,
	bodyPart: string,
	nowMs: number = Date.now()
): boolean {
	const until = map[bodyPart];
	return typeof until === 'number' && until > nowMs;
}

/** Profile dot: a finished workout landed after the last visit to the coach screen. */
export function coachBadgeVisible(
	lastFinishedAt: string | null | undefined,
	seenAtMs: number
): boolean {
	if (!lastFinishedAt) return false;
	const finished = Date.parse(lastFinishedAt);
	return Number.isFinite(finished) && finished > seenAtMs;
}

export type CoachReplace = {
	fromExerciseId: string;
	toExerciseId: string;
	bodyPart: string;
};

/** Window set-shares + undertrained parts for coach Add/Replace (same signal). */
export function coachUndertrainedParts(
	finishedSessions: readonly WorkoutSession[],
	bodyPartFor: (exerciseId: string) => string | null,
	opts: { now?: Date; limit?: number } = {}
): { shares: ReturnType<typeof setShares>; undertrained: string[] } {
	const now = opts.now ?? new Date();
	const recent = finishedSessionsWithinDays([...finishedSessions], 30, now);
	if (recent.length === 0) return { shares: [], undertrained: [] };
	const shares = setShares(
		mergeSetMaps(recent.map((s) => sessionSetsByBodyPart(s, bodyPartFor)))
	);
	return {
		shares,
		undertrained: undertrainedBodyParts(shares, { limit: opts.limit ?? 3 })
	};
}

/** Swap one plan exercise that sits on an undertrained body part. */
export function suggestPlanReplace(
	planExerciseIds: readonly string[],
	lagging: readonly string[],
	catalog: readonly ExerciseIndexItem[],
	bodyPartFor: (exerciseId: string) => string | null
): CoachReplace | null {
	for (const part of lagging) {
		const fromExerciseId = planExerciseIds.find((id) => bodyPartFor(id) === part);
		if (!fromExerciseId) continue;
		const toExerciseId = pickCatalogExerciseForBodyPart(
			catalog,
			part,
			new Set([...planExerciseIds, fromExerciseId])
		);
		if (!toExerciseId || toExerciseId === fromExerciseId) continue;
		return { fromExerciseId, toExerciseId, bodyPart: part };
	}
	return null;
}

export function buildCoachHints(
	_focusSession: WorkoutSession,
	finishedSessions: readonly WorkoutSession[],
	catalog: readonly ExerciseIndexItem[],
	bodyPartFor: (exerciseId: string) => string | null,
	opts: CoachHintOptions = {}
): CoachHint[] {
	const { shares, undertrained } = coachUndertrainedParts(finishedSessions, bodyPartFor, {
		now: opts.now
	});
	if (undertrained.length === 0) return [];

	const shareByPart = new Map(shares.map((row) => [row.bodyPart, row.sharePct] as const));
	const exclude = new Set(opts.planExerciseIds ?? []);
	const skipParts = opts.excludeBodyParts ?? new Set<string>();

	const hints: CoachHint[] = [];
	for (const part of undertrained) {
		if (skipParts.has(part)) continue;
		const exerciseId = pickCatalogExerciseForBodyPart(catalog, part, exclude);
		if (!exerciseId) continue;
		hints.push({
			id: `lag-${part}-${exerciseId}`,
			bodyPart: part,
			exerciseId,
			reasonKey: 'coach.hintLagging',
			sharePct: shareByPart.get(part) ?? 0
		});
		if (hints.length >= 3) break;
	}
	return hints;
}

function selfCheckSession(
	id: string,
	finishedAt: string,
	exerciseId: string,
	sets = 1
): WorkoutSession {
	return {
		id,
		planId: null,
		planName: 'Plan',
		startedAt: finishedAt,
		finishedAt,
		exercises: [
			{
				exerciseId,
				targetSets: sets,
				targetReps: 5,
				restSec: 90,
				sets: Array.from({ length: sets }, () => ({
					weightKg: 100,
					reps: 5,
					completed: true,
					kind: 'work' as const
				}))
			}
		]
	};
}

/** Guards the hint contract: undertrained set-share + popularity-aware pick. */
export function runCoachHintsSelfCheck(): void {
	const now = new Date('2026-02-10T12:00:00.000Z');
	const partFor = (id: string): string | null => {
		if (id.startsWith('back')) return 'back';
		if (id.startsWith('chest')) return 'chest';
		if (id.startsWith('arm')) return 'upper arms';
		return null;
	};
	const catalog: ExerciseIndexItem[] = [
		{
			id: 'back-assisted',
			name: 'assisted pull-up',
			body_part: 'back',
			equipment: 'band',
			target: 'lats',
			muscle_group: 'back',
			secondary_muscles: [],
			image: '',
			globalPopularity: 90
		},
		{
			id: 'back-staple',
			name: 'pull-up',
			body_part: 'back',
			equipment: 'body weight',
			target: 'lats',
			muscle_group: 'back',
			secondary_muscles: [],
			image: '',
			globalPopularity: 80
		},
		{
			id: 'chest-1',
			name: 'bench press',
			body_part: 'chest',
			equipment: 'barbell',
			target: 'pectorals',
			muscle_group: 'chest',
			secondary_muscles: [],
			image: '',
			globalPopularity: 95
		},
		{
			id: 'arm-1',
			name: 'curl',
			body_part: 'upper arms',
			equipment: 'dumbbell',
			target: 'biceps',
			muscle_group: 'arms',
			secondary_muscles: [],
			image: '',
			globalPopularity: 70
		}
	];

	// Chest dominates sets; back is undertrained. Last session was chest-only
	// (old skip-usual would have suggested chest Add - must NOT).
	const focus = selfCheckSession('s-focus', '2026-02-10T09:00:00.000Z', 'chest-1', 6);
	const olderChest = selfCheckSession('s-chest', '2026-02-07T09:00:00.000Z', 'chest-1', 4);
	const olderBack = selfCheckSession('s-back', '2026-02-05T09:00:00.000Z', 'back-staple', 1);
	const sessions = [focus, olderChest, olderBack];

	const hints = buildCoachHints(focus, sessions, catalog, partFor, { now });
	if (hints.some((h) => h.bodyPart === 'chest')) {
		throw new Error('coachHints: dominant chest must not get an Add hint');
	}
	if (hints.length < 1 || hints[0]!.bodyPart !== 'back') {
		throw new Error('coachHints: undertrained back must be hinted first');
	}
	if (hints[0]!.exerciseId !== 'back-staple') {
		throw new Error('coachHints: pick must prefer non-assisted over higher popularity assisted');
	}
	if (hints[0]!.sharePct >= 50) {
		throw new Error(`coachHints: undertrained share must be low, got ${hints[0]!.sharePct}`);
	}

	const excluded = buildCoachHints(focus, sessions, catalog, partFor, {
		now,
		planExerciseIds: ['back-staple', 'chest-1']
	});
	if (excluded.length !== 1 || excluded[0]!.exerciseId !== 'back-assisted') {
		throw new Error('coachHints: plan exercises must not be suggested');
	}

	const skipBack = buildCoachHints(focus, sessions, catalog, partFor, {
		now,
		excludeBodyParts: new Set(['back'])
	});
	if (skipBack.some((h) => h.bodyPart === 'back')) {
		throw new Error('coachHints: replace body part must not duplicate as Add');
	}

	const exhausted = buildCoachHints(focus, sessions, catalog, partFor, {
		now,
		planExerciseIds: ['back-staple', 'back-assisted']
	});
	if (exhausted.some((h) => h.bodyPart === 'back')) {
		throw new Error('coachHints: no back hint when every candidate is already in the plan');
	}

	if (buildCoachHints(focus, [], catalog, partFor, { now }).length !== 0) {
		throw new Error('coachHints: no hints without finished sessions');
	}

	const replace = suggestPlanReplace(
		['back-staple', 'chest-1'],
		['back'],
		catalog,
		partFor
	);
	if (!replace || replace.fromExerciseId !== 'back-staple' || replace.toExerciseId !== 'back-assisted') {
		throw new Error('coachHints: replace must swap undertrained plan slot');
	}

	const nowMs = now.getTime();
	const raw = JSON.stringify({ back: nowMs + 1000, chest: nowMs - 1000, arms: 'oops' });
	const hidden = parseCoachHidden(raw, nowMs);
	if (!isCoachPartHidden(hidden, 'back', nowMs)) {
		throw new Error('coachHints: future hide entry must stay hidden');
	}
	if (isCoachPartHidden(hidden, 'chest', nowMs) || isCoachPartHidden(hidden, 'arms', nowMs)) {
		throw new Error('coachHints: expired or malformed hide entries must be dropped');
	}
	const hiddenBack = hideCoachPart({}, 'back', nowMs);
	if (hiddenBack.back !== nowMs + COACH_HIDE_MS) {
		throw new Error('coachHints: hide window must be 7 days');
	}
	if (Object.keys(unhideCoachPart(hiddenBack, 'back')).length !== 0) {
		throw new Error('coachHints: unhide must clear the entry');
	}
	if (!coachBadgeVisible(new Date(nowMs + 1000).toISOString(), nowMs)) {
		throw new Error('coachHints: newer workout must show the badge');
	}
	if (coachBadgeVisible(new Date(nowMs).toISOString(), nowMs)) {
		throw new Error('coachHints: seen state must hide the badge');
	}
}
