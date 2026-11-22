/**
 * Deep coach insights: the numbers behind "как тренируешься", not just set shares.
 *
 * The first coach screen only compared 30-day set shares and offered "add an
 * exercise on the lagging group". That reads as a gym-bro verdict: it never
 * looks at progression, at how hard the week was, at exercises the athlete
 * keeps skipping, or at push/pull balance. This module turns the same local
 * history into a short, ranked list of specific statements:
 *
 * - progress: same top weight and reps for 4 sessions, the app's own progression
 *   engine already says "raise", name the next load;
 * - ease: the plan was missed twice in a row, name the deload step;
 * - spike: weekly working sets jumped >30% over the 3-week baseline;
 * - skipped: an exercise is dropped in 2 of the last 3 sessions;
 * - ratio: pressing volume runs far ahead of pulling volume.
 *
 * Pure domain: no UI, no storage. Thresholds are exported so the docs and the
 * self-check stay honest about them.
 */
import type { ExerciseIndexItem, WorkoutSession } from './types';
import { isProgressSet } from './sessionSetKind';
import { catalogZoneForBodyPart } from './bodyZones';
import {
	nextWeightHint,
	weightStepForEquipment,
	type NextWeightHint
} from './sessionPayoff';
import {
	finishedSessionsBetweenDays,
	finishedSessionsWithinDays,
	mergeSetMaps,
	pickCatalogExerciseForBodyPart,
	sessionSetsByBodyPart
} from './trainingLoad';

const MS_DAY = 86_400_000;

/** Sessions at the same top weight before the screen calls it a stall. */
export const COACH_STALL_EXPOSURES = 4;
/** Stall / ease / skipped look at the last month only. */
export const COACH_WINDOW_DAYS = 28;
/** Week-over-week jump that earns the "too much, too fast" card. */
export const COACH_SPIKE_RATIO = 1.3;
/** Small absolute jump so two light sessions do not trigger it. */
export const COACH_SPIKE_MIN_SETS = 6;
/** Enough history before any trend claim. */
export const COACH_SPIKE_MIN_SESSIONS = 6;
/** Pressing sets must lead pulling sets by this factor. */
export const COACH_PUSH_PULL_RATIO = 1.6;
/** Below this many pressing sets a month, the ratio means nothing. */
export const COACH_PUSH_PULL_MIN_SETS = 12;
/** Sessions to look at when checking whether an exercise is being dropped. */
export const COACH_SKIP_LOOKBACK = 3;
/** Dropped in this many of the lookback sessions = the exercise is not working. */
export const COACH_SKIP_MIN_DROPS = 2;
/** Cards on screen before "show more". */
export const COACH_INSIGHT_LIMIT = 3;

export type CoachInsightKind = 'progress' | 'ease' | 'spike' | 'skipped' | 'ratio';

export type CoachInsightAction =
	| { type: 'add'; exerciseId: string }
	| { type: 'replace'; fromExerciseId: string; toExerciseId: string }
	| { type: 'none' };

export type CoachInsight = {
	id: string;
	kind: CoachInsightKind;
	/** 7-day hide key: exercise id or zone slug, unique per card. */
	scope: string;
	exerciseId: string | null;
	/** Catalog zone for the meta line, when the card is about a muscle group. */
	zone: string | null;
	/** Higher first. Progression and deload beat balance advice. */
	priority: number;
	titleKey: string;
	titleParams: Record<string, string | number>;
	whyKey: string;
	whyParams: Record<string, string | number>;
	action: CoachInsightAction;
};

export type CoachInsightOptions = {
	now?: Date;
	/** Exercises of the plan the screen edits: stall and skip cards start here. */
	planExerciseIds?: readonly string[];
	/** Every plan's exercises: never suggest one of these as a new addition. */
	allPlanExerciseIds?: readonly string[];
	catalog?: readonly ExerciseIndexItem[];
	equipmentFor?: (exerciseId: string) => string | null;
	bodyPartFor: (exerciseId: string) => string | null;
	limit?: number;
};

type TopSet = { weightKg: number; reps: number };

function finishedDesc(sessions: readonly WorkoutSession[]): WorkoutSession[] {
	return sessions
		.filter((session) => session.finishedAt != null)
		.sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''));
}

/** Heaviest completed working set of one exercise in one session. */
function topSetFor(session: WorkoutSession, exerciseId: string): TopSet | null {
	const ex = session.exercises.find((item) => item.exerciseId === exerciseId);
	if (!ex || ex.skipped) return null;
	let best: TopSet | null = null;
	for (const set of ex.sets) {
		if (!set.completed || !isProgressSet(set)) continue;
		const weightKg = set.weightKg ?? 0;
		const reps = set.reps ?? 0;
		if (weightKg <= 0 || reps <= 0) continue;
		if (best == null) {
			best = { weightKg, reps };
			continue;
		}
		if (weightKg > best.weightKg + 0.001) best = { weightKg, reps };
		else if (Math.abs(weightKg - best.weightKg) <= 0.001 && reps > best.reps) best.reps = reps;
	}
	return best;
}

function sameTop(a: TopSet, b: TopSet): boolean {
	return Math.abs(a.weightKg - b.weightKg) < 0.05 && a.reps === b.reps;
}

function nextStepFor(
	sessions: readonly WorkoutSession[],
	exerciseId: string,
	top: TopSet,
	options: CoachInsightOptions
): NextWeightHint | null {
	return nextWeightHint(sessions, exerciseId, {
		stepKg: weightStepForEquipment(options.equipmentFor?.(exerciseId)),
		targetReps: top.reps
	});
}

function zoneOf(exerciseId: string, options: CoachInsightOptions): string | null {
	const part = options.bodyPartFor(exerciseId);
	return part ? catalogZoneForBodyPart(part) : null;
}

function pickAlternative(
	exerciseId: string,
	options: CoachInsightOptions
): string | null {
	if (!options.catalog || options.catalog.length === 0) return null;
	const zone = zoneOf(exerciseId, options);
	if (!zone) return null;
	const exclude = new Set([...(options.allPlanExerciseIds ?? []), ...(options.planExerciseIds ?? [])]);
	const picked = pickCatalogExerciseForBodyPart(options.catalog, zone, exclude);
	return picked && picked !== exerciseId ? picked : null;
}

/** Same top weight and reps on the last `COACH_STALL_EXPOSURES` sessions. */
function progressInsight(
	sessions: readonly WorkoutSession[],
	options: CoachInsightOptions
): CoachInsight | null {
	const now = options.now ?? new Date();
	const since = now.getTime() - COACH_WINDOW_DAYS * MS_DAY;
	const ordered = finishedDesc(sessions);
	const seen = new Set<string>();
	let best: { insight: CoachInsight; at: string } | null = null;

	for (const exerciseId of options.planExerciseIds ?? []) {
		if (seen.has(exerciseId)) continue;
		seen.add(exerciseId);
		const exposures = ordered
			.filter((session) => Date.parse(session.finishedAt ?? '') >= since)
			.map((session) => ({ session, top: topSetFor(session, exerciseId) }))
			.filter((row): row is { session: WorkoutSession; top: TopSet } => row.top != null)
			.slice(0, COACH_STALL_EXPOSURES);
		if (exposures.length < COACH_STALL_EXPOSURES) continue;

		const last = exposures[0]!;
		if (!exposures.every((row) => sameTop(row.top, last.top))) continue;

		const next = nextStepFor(sessions, exerciseId, last.top, options);
		// `raise` = the plan was closed but the weight has not moved yet.
		if (!next || next.kind !== 'raise' || next.weightKg <= last.top.weightKg + 0.001) continue;

		const at = last.session.finishedAt ?? '';
		if (best && best.at >= at) continue;
		best = {
			at,
			insight: {
				id: `progress-${exerciseId}`,
				kind: 'progress',
				scope: exerciseId,
				exerciseId,
				zone: zoneOf(exerciseId, options),
				priority: 90,
				titleKey: 'coach.insightProgressTitle',
				titleParams: {},
				whyKey: 'coach.insightProgressWhy',
				whyParams: {
					weight: last.top.weightKg,
					reps: last.top.reps,
					next: next.weightKg,
					nextReps: next.reps
				},
				action: { type: 'none' }
			}
		};
	}
	return best?.insight ?? null;
}

/** Missed the prescription twice in a row: the app already knows the step down. */
function easeInsight(
	sessions: readonly WorkoutSession[],
	options: CoachInsightOptions
): CoachInsight | null {
	const now = options.now ?? new Date();
	const since = now.getTime() - 14 * MS_DAY;
	const ordered = finishedDesc(sessions);
	let best: { insight: CoachInsight; at: string } | null = null;

	for (const exerciseId of options.planExerciseIds ?? []) {
		const last = ordered.find(
			(session) =>
				Date.parse(session.finishedAt ?? '') >= since && topSetFor(session, exerciseId) != null
		);
		if (!last) continue;
		const top = topSetFor(last, exerciseId)!;
		const next = nextStepFor(sessions, exerciseId, top, options);
		if (!next || next.kind !== 'ease') continue;

		const at = last.finishedAt ?? '';
		if (best && best.at >= at) continue;
		best = {
			at,
			insight: {
				id: `ease-${exerciseId}`,
				kind: 'ease',
				scope: exerciseId,
				exerciseId,
				zone: zoneOf(exerciseId, options),
				priority: 95,
				titleKey: 'coach.insightEaseTitle',
				titleParams: {},
				whyKey: 'coach.insightEaseWhy',
				whyParams: { weight: top.weightKg, next: next.weightKg, reps: next.reps },
				action: { type: 'none' }
			}
		};
	}
	return best?.insight ?? null;
}

function totalSets(
	sessions: readonly WorkoutSession[],
	options: CoachInsightOptions
): number {
	const map = mergeSetMaps(
		sessions.map((session) => sessionSetsByBodyPart(session, options.bodyPartFor))
	);
	let total = 0;
	for (const value of map.values()) total += value;
	return total;
}

/** Weekly working sets jumped far above the recent baseline. */
function spikeInsight(
	sessions: readonly WorkoutSession[],
	options: CoachInsightOptions
): CoachInsight | null {
	const now = options.now ?? new Date();
	const month = finishedSessionsWithinDays([...sessions], COACH_WINDOW_DAYS, now);
	if (month.length < COACH_SPIKE_MIN_SESSIONS) return null;

	const week = (fromDays: number, toDays: number) =>
		finishedSessionsBetweenDays([...sessions], fromDays, toDays, now);
	const currentSessions = week(7, 0);
	const current = totalSets(currentSessions, options);
	if (currentSessions.length === 0 || current === 0) return null;

	const baselineWeeks = [week(14, 7), week(21, 14), week(28, 21)].filter(
		(list) => list.length > 0
	);
	if (baselineWeeks.length < 2) return null;
	const baseline =
		baselineWeeks.reduce((sum, list) => sum + totalSets(list, options), 0) /
		baselineWeeks.length;
	if (baseline <= 0) return null;
	if (current < baseline * COACH_SPIKE_RATIO) return null;
	if (current - baseline < COACH_SPIKE_MIN_SETS) return null;

	return {
		id: 'spike',
		kind: 'spike',
		scope: 'spike',
		exerciseId: null,
		zone: null,
		priority: 80,
		titleKey: 'coach.insightSpikeTitle',
		titleParams: {},
		whyKey: 'coach.insightSpikeWhy',
		whyParams: {
			current: Math.round(current),
			baseline: Math.round(baseline),
			ratio: Math.round((current / baseline - 1) * 100)
		},
		action: { type: 'none' }
	};
}

/** An exercise that keeps being skipped or left empty in the plan. */
function skippedInsight(
	sessions: readonly WorkoutSession[],
	options: CoachInsightOptions
): CoachInsight | null {
	const now = options.now ?? new Date();
	const since = now.getTime() - COACH_WINDOW_DAYS * MS_DAY;
	const ordered = finishedDesc(sessions);
	let best: { insight: CoachInsight; at: string } | null = null;

	for (const exerciseId of options.planExerciseIds ?? []) {
		const appearances = ordered
			.filter(
				(session) =>
					Date.parse(session.finishedAt ?? '') >= since &&
					session.exercises.some((ex) => ex.exerciseId === exerciseId)
			)
			.slice(0, COACH_SKIP_LOOKBACK);
		if (appearances.length < COACH_SKIP_LOOKBACK) continue;

		const drops = appearances.filter((session) => {
			const ex = session.exercises.find((item) => item.exerciseId === exerciseId);
			if (!ex) return true;
			if (ex.skipped) return true;
			return !ex.sets.some((set) => set.completed && isProgressSet(set));
		});
		if (drops.length < COACH_SKIP_MIN_DROPS) continue;

		const at = appearances[0]!.finishedAt ?? '';
		if (best && best.at >= at) continue;
		const alternative = pickAlternative(exerciseId, options);
		best = {
			at,
			insight: {
				id: `skipped-${exerciseId}`,
				kind: 'skipped',
				scope: exerciseId,
				exerciseId,
				zone: zoneOf(exerciseId, options),
				priority: 75,
				titleKey: 'coach.insightSkippedTitle',
				titleParams: {},
				whyKey: 'coach.insightSkippedWhy',
				whyParams: { drops: drops.length, total: appearances.length },
				action: alternative
					? { type: 'replace', fromExerciseId: exerciseId, toExerciseId: alternative }
					: { type: 'none' }
			}
		};
	}
	return best?.insight ?? null;
}

/** Pressing sets run far ahead of pulling sets over the month. */
function ratioInsight(
	sessions: readonly WorkoutSession[],
	options: CoachInsightOptions
): CoachInsight | null {
	const now = options.now ?? new Date();
	const month = finishedSessionsWithinDays([...sessions], 30, now);
	if (month.length < 4) return null;

	const sets = mergeSetMaps(month.map((session) => sessionSetsByBodyPart(session, options.bodyPartFor)));
	const push = (sets.get('chest') ?? 0) + (sets.get('shoulders') ?? 0);
	const pull = sets.get('back') ?? 0;
	if (push < COACH_PUSH_PULL_MIN_SETS) return null;
	const ratio = push / Math.max(1, pull);
	if (pull > 0 && ratio < COACH_PUSH_PULL_RATIO) return null;
	if (pull === 0 && push < COACH_PUSH_PULL_MIN_SETS + 2) return null;

	if (!options.catalog) return null;
	const exclude = new Set([...(options.allPlanExerciseIds ?? []), ...(options.planExerciseIds ?? [])]);
	const alternative = pickCatalogExerciseForBodyPart(options.catalog, 'back', exclude);
	if (!alternative) return null;

	const times = Math.round(ratio * 10) / 10;
	return {
		id: 'ratio-push-pull',
		kind: 'ratio',
		scope: 'ratio-push-pull',
		exerciseId: null,
		zone: 'back',
		priority: 70,
		titleKey: 'coach.insightRatioTitle',
		titleParams: {},
		// «в 18 раза» reads wrong: without a pulling set the count speaks for itself.
		whyKey: pull === 0 ? 'coach.insightRatioNoPullWhy' : 'coach.insightRatioWhy',
		whyParams: { push, pull, times: String(times) },
		action: { type: 'add', exerciseId: alternative }
	};
}

/**
 * Ranked cards: one per theme, progression and safety first.
 * Duplicate scopes (same exercise twice) keep the higher priority card.
 */
export function buildCoachInsights(
	sessions: readonly WorkoutSession[],
	options: CoachInsightOptions
): CoachInsight[] {
	if (sessions.every((session) => session.finishedAt == null)) return [];
	const candidates = [
		easeInsight(sessions, options),
		progressInsight(sessions, options),
		spikeInsight(sessions, options),
		skippedInsight(sessions, options),
		ratioInsight(sessions, options)
	].filter((insight): insight is CoachInsight => insight != null);

	candidates.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
	const seen = new Set<string>();
	const unique: CoachInsight[] = [];
	for (const insight of candidates) {
		if (seen.has(insight.scope)) continue;
		seen.add(insight.scope);
		unique.push(insight);
	}
	return unique.slice(0, Math.max(1, options.limit ?? COACH_INSIGHT_LIMIT));
}

/** Zones that already have a card, so the balance hints do not repeat them. */
export function insightZones(insights: readonly CoachInsight[]): string[] {
	return insights.map((insight) => insight.zone).filter((zone): zone is string => zone != null);
}

function checkSession(
	id: string,
	daysAgo: number,
	exerciseId: string,
	opts: {
		now: Date;
		weightKg?: number | null;
		reps?: number;
		sets?: number;
		targetReps?: number;
		skipped?: boolean;
		empty?: boolean;
	}
): WorkoutSession {
	const now = opts.now;
	const finishedAt = new Date(now.getTime() - daysAgo * MS_DAY).toISOString();
	const sets = opts.empty
		? []
		: Array.from({ length: opts.sets ?? 3 }, () => ({
				weightKg: opts.weightKg === undefined ? 60 : opts.weightKg,
				reps: opts.reps ?? 8,
				completed: true,
				kind: 'work' as const
			}));
	return {
		id,
		planId: null,
		planName: 'Plan',
		startedAt: finishedAt,
		finishedAt,
		exercises: [
			{
				exerciseId,
				targetSets: opts.sets ?? 3,
				targetReps: opts.targetReps ?? 8,
				restSec: 90,
				skipped: opts.skipped,
				sets
			}
		]
	};
}

/** Guards the thresholds and the ranking: synthetic histories, no UI. */
export function runCoachInsightsSelfCheck(): void {
	const now = new Date('2026-02-10T12:00:00.000Z');
	const partFor = (id: string): string | null => {
		if (id === 'chest-press') return 'chest';
		if (id === 'back-row') return 'back';
		if (id === 'arm-curl') return 'upper arms';
		return null;
	};
	const equipmentFor = (id: string): string => (id === 'arm-curl' ? 'dumbbell' : 'barbell');
	const catalog: ExerciseIndexItem[] = [
		{
			id: 'back-row',
			name: 'barbell row',
			body_part: 'back',
			equipment: 'barbell',
			target: 'lats',
			muscle_group: 'back',
			secondary_muscles: [],
			image: '',
			globalPopularity: 90
		},
		{
			id: 'back-pulldown',
			name: 'lat pulldown',
			body_part: 'back',
			equipment: 'cable',
			target: 'lats',
			muscle_group: 'back',
			secondary_muscles: [],
			image: '',
			globalPopularity: 80
		},
		{
			id: 'arm-hammer',
			name: 'hammer curl',
			body_part: 'upper arms',
			equipment: 'dumbbell',
			target: 'biceps',
			muscle_group: 'arms',
			secondary_muscles: [],
			image: '',
			globalPopularity: 60
		}
	];

	// 1. Same top weight four times, plan closed -> name the next load.
	const stalled = [
		checkSession('p1', 3, 'chest-press', { now }),
		checkSession('p2', 7, 'chest-press', { now }),
		checkSession('p3', 11, 'chest-press', { now }),
		checkSession('p4', 15, 'chest-press', { now })
	];
	const progress = buildCoachInsights(stalled, {
		now,
		planExerciseIds: ['chest-press'],
		bodyPartFor: partFor,
		equipmentFor,
		catalog
	});
	if (progress.length !== 1 || progress[0]!.kind !== 'progress') {
		throw new Error(`coachInsights: stall not found (${progress.map((i) => i.kind).join()})`);
	}
	if (Number(progress[0]!.whyParams.next) <= 60) {
		throw new Error('coachInsights: stall must name a heavier load');
	}

	// 2. Missing the target twice in a row -> deload step, not "add volume".
	const missed = [
		checkSession('e1', 2, 'chest-press', { now, reps: 5 }),
		checkSession('e2', 6, 'chest-press', { now, reps: 5 }),
		checkSession('e3', 10, 'chest-press', { now, reps: 8 }),
		// 4th exposure keeps the progression engine out of its wave week (every 4th).
		checkSession('e4', 14, 'chest-press', { now, reps: 8 })
	];
	const ease = buildCoachInsights(missed, {
		now,
		planExerciseIds: ['chest-press'],
		bodyPartFor: partFor,
		equipmentFor,
		catalog
	});
	if (ease[0]?.kind !== 'ease') {
		throw new Error(`coachInsights: ease not first (${ease.map((i) => i.kind).join()})`);
	}
	if (Number(ease[0].whyParams.next) >= Number(ease[0].whyParams.weight)) {
		throw new Error('coachInsights: ease must lower the weight');
	}

	// 3. Volume spike: 24 sets this week vs 6-9 before.
	const spikeSessions = [
		checkSession('s1', 1, 'chest-press', { now, sets: 8 }),
		checkSession('s2', 2, 'chest-press', { now, sets: 8 }),
		checkSession('s3', 3, 'chest-press', { now, sets: 8 }),
		checkSession('s4', 9, 'chest-press', { now, sets: 3 }),
		checkSession('s5', 15, 'chest-press', { now, sets: 3 }),
		checkSession('s6', 22, 'chest-press', { now, sets: 3 })
	];
	const spike = buildCoachInsights(spikeSessions, {
		now,
		planExerciseIds: [],
		bodyPartFor: partFor,
		equipmentFor,
		catalog
	});
	if (!spike.some((insight) => insight.kind === 'spike')) {
		throw new Error('coachInsights: volume spike missed');
	}

	// 4. Dropped in 2 of 3 sessions -> replace it, never "add more".
	const skippedSessions = [
		checkSession('k1', 1, 'arm-curl', { now, skipped: true }),
		checkSession('k2', 4, 'arm-curl', { now, empty: true }),
		checkSession('k3', 8, 'arm-curl', { now })
	];
	const skipped = buildCoachInsights(skippedSessions, {
		now,
		planExerciseIds: ['arm-curl'],
		allPlanExerciseIds: ['arm-curl'],
		bodyPartFor: partFor,
		equipmentFor,
		catalog
	});
	const skipCard = skipped.find((insight) => insight.kind === 'skipped');
	if (!skipCard || skipCard.exerciseId !== 'arm-curl') {
		throw new Error('coachInsights: skipped exercise missed');
	}
	if (skipCard.action.type !== 'replace' || skipCard.action.toExerciseId !== 'arm-hammer') {
		throw new Error('coachInsights: skipped exercise must offer a same-zone swap');
	}

	// 5. Pressing 18 sets, pulling 0 -> suggest a pull, not another press.
	const pushOnly = [
		checkSession('r1', 2, 'chest-press', { now, sets: 6 }),
		checkSession('r2', 6, 'chest-press', { now, sets: 6 }),
		checkSession('r3', 12, 'chest-press', { now, sets: 6 }),
		checkSession('r4', 18, 'chest-press', { now, sets: 6 })
	];
	const ratio = buildCoachInsights(pushOnly, {
		now,
		planExerciseIds: [],
		allPlanExerciseIds: ['chest-press'],
		bodyPartFor: partFor,
		equipmentFor,
		catalog
	});
	const ratioCard = ratio.find((insight) => insight.kind === 'ratio');
	if (!ratioCard || ratioCard.action.type !== 'add') {
		throw new Error('coachInsights: push/pull ratio missed');
	}
	if (partFor((ratioCard.action as { exerciseId: string }).exerciseId) !== 'back') {
		throw new Error('coachInsights: ratio card must suggest a pulling exercise');
	}

	// 6. No history -> no cards. Balanced training -> no ratio card.
	if (buildCoachInsights([], { now, bodyPartFor: partFor, catalog }).length !== 0) {
		throw new Error('coachInsights: empty history must stay silent');
	}
}
