import type { ExerciseIndexItem } from './types';
import type { WorkoutSession } from './types';
import {
	finishedSessionsWithinDays,
	laggingBodyParts,
	pickCatalogExerciseForBodyPart,
	sessionVolumeByBodyPart,
	mergeVolumeMaps,
	volumeShares
} from './trainingLoad';

export type CoachHint = {
	id: string;
	bodyPart: string;
	exerciseId: string;
	reasonKey: 'coach.hintLagging';
	/** Share of the 30-day volume on this body part, % (rounded). */
	sharePct: number;
};

export type CoachHintOptions = {
	now?: Date;
	/** Exercises already in the target plan - never suggest them again. */
	planExerciseIds?: readonly string[];
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

/** Swap one plan exercise that sits on a lagging body part. */
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
	focusSession: WorkoutSession,
	finishedSessions: readonly WorkoutSession[],
	catalog: readonly ExerciseIndexItem[],
	bodyPartFor: (exerciseId: string) => string | null,
	opts: CoachHintOptions = {}
): CoachHint[] {
	const now = opts.now ?? new Date();
	const recent = finishedSessionsWithinDays([...finishedSessions], 30, now);
	if (recent.length === 0) return [];

	const todayMap = sessionVolumeByBodyPart(focusSession, bodyPartFor);
	const windowMaps = recent.map((s) => sessionVolumeByBodyPart(s, bodyPartFor));
	const windowMap = mergeVolumeMaps(windowMaps);
	const lagging = laggingBodyParts(todayMap, windowMap);
	const shareByPart = new Map(
		volumeShares(windowMap).map((row) => [row.bodyPart, row.sharePct] as const)
	);
	const exclude = new Set(opts.planExerciseIds ?? []);

	const hints: CoachHint[] = [];
	for (const part of lagging) {
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

function selfCheckSession(id: string, finishedAt: string, exerciseId: string): WorkoutSession {
	return {
		id,
		planId: null,
		planName: 'Plan',
		startedAt: finishedAt,
		finishedAt,
		exercises: [
			{
				exerciseId,
				targetSets: 1,
				targetReps: 5,
				restSec: 90,
				sets: [{ weightKg: 100, reps: 5, completed: true }]
			}
		]
	};
}

/** Guards the hint contract: numbers in the card and plan-aware picking. */
export function runCoachHintsSelfCheck(): void {
	const now = new Date('2026-02-10T12:00:00.000Z');
	const partFor = (id: string): string | null =>
		id.startsWith('back') ? 'back' : id.startsWith('chest') ? 'chest' : null;
	const catalog: ExerciseIndexItem[] = [
		{ id: 'back-1', body_part: 'back' },
		{ id: 'back-2', body_part: 'back' },
		{ id: 'chest-1', body_part: 'chest' }
	] as ExerciseIndexItem[];
	const focus = selfCheckSession('s-focus', '2026-02-10T09:00:00.000Z', 'chest-1');
	const older = selfCheckSession('s-old', '2026-02-07T09:00:00.000Z', 'back-1');
	const sessions = [focus, older];

	const hints = buildCoachHints(focus, sessions, catalog, partFor, { now });
	if (hints.length !== 1) throw new Error('coachHints: only the skipped part must be hinted');
	if (hints[0].bodyPart !== 'back') throw new Error('coachHints: lagging part drifted');
	if (hints[0].exerciseId !== 'back-1') {
		throw new Error('coachHints: catalog pick must stay stable');
	}
	if (hints[0].sharePct !== 50) {
		throw new Error(`coachHints: share must be 50%, got ${hints[0].sharePct}`);
	}

	const excluded = buildCoachHints(focus, sessions, catalog, partFor, {
		now,
		planExerciseIds: ['back-1', 'chest-1']
	});
	if (excluded.length !== 1 || excluded[0].exerciseId !== 'back-2') {
		throw new Error('coachHints: plan exercises must not be suggested');
	}

	const exhausted = buildCoachHints(focus, sessions, catalog, partFor, {
		now,
		planExerciseIds: ['back-1', 'back-2']
	});
	if (exhausted.length !== 0) {
		throw new Error('coachHints: no hint when every candidate is already in the plan');
	}

	if (buildCoachHints(focus, [], catalog, partFor, { now }).length !== 0) {
		throw new Error('coachHints: no hints without finished sessions');
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
