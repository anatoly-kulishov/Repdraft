/**
 * Volume by catalog body_part for summary / coach hints.
 * Pure domain - no UI.
 */
import type { WorkoutSession } from './types';
import { visibleSessionExerciseIndices } from './session';
import { isProgressSet } from './sessionSetKind';
import { catalogZoneForBodyPart, zoneBodyParts } from './bodyZones';

const MS_DAY = 86_400_000;

export type BodyPartShare = {
	bodyPart: string;
	volumeKg: number;
	sharePct: number;
};

/** Completed working sets for one catalog zone in a recent window. */
export type ZoneWeekSets = {
	bodyPart: string;
	sets: number;
};

/**
 * Evidence-informed aim for weekly working sets per muscle group: the
 * dose-response curve separates 10+ sets from <5 and 5-9. Orientation, not a
 * quota, and bars are scaled to it.
 */
export const WEEKLY_SETS_AIM = 10;

/** Share of completed working sets per body_part (coach balance / undertrained). */
export type BodyPartSetShare = {
	bodyPart: string;
	sets: number;
	sharePct: number;
};

export type CatalogPickItem = {
	id: string;
	body_part: string;
	name?: string;
	globalPopularity?: number;
};

function setVolumeKg(weightKg: number | null, reps: number | null): number {
	if (weightKg == null || reps == null || weightKg <= 0 || reps <= 0) return 0;
	return weightKg * reps;
}

export function sessionVolumeByBodyPart(
	session: WorkoutSession,
	bodyPartFor: (exerciseId: string) => string | null
): Map<string, number> {
	const map = new Map<string, number>();
	for (const i of visibleSessionExerciseIndices(session)) {
		const ex = session.exercises[i];
		if (!ex) continue;
		const part = bodyPartFor(ex.exerciseId);
		if (!part) continue;
		// Shares speak the catalog's zones: «Голени» is part of «Ноги», not a rival group.
		const zone = catalogZoneForBodyPart(part);
		let vol = 0;
		for (const set of ex.sets) {
			if (!set.completed) continue;
			vol += setVolumeKg(set.weightKg, set.reps);
		}
		if (vol <= 0) continue;
		map.set(zone, (map.get(zone) ?? 0) + vol);
	}
	return map;
}

export function mergeVolumeMaps(maps: readonly Map<string, number>[]): Map<string, number> {
	const out = new Map<string, number>();
	for (const map of maps) {
		for (const [part, vol] of map) {
			out.set(part, (out.get(part) ?? 0) + vol);
		}
	}
	return out;
}

/**
 * Completed working sets per catalog body_part in a session.
 * Working sets = completed, non-warmup log entries (matches `isProgressSet`).
 * Used for the "share by sets" view: legs squatting heavy leaves arms looking
 * balanced, but a set is a set — this avoids the volume-weight bias.
 */
export function sessionSetsByBodyPart(
	session: WorkoutSession,
	bodyPartFor: (exerciseId: string) => string | null
): Map<string, number> {
	const map = new Map<string, number>();
	for (const i of visibleSessionExerciseIndices(session)) {
		const ex = session.exercises[i];
		if (!ex) continue;
		const part = bodyPartFor(ex.exerciseId);
		if (!part) continue;
		// Same zone merge as the volume map, so both views name groups alike.
		const zone = catalogZoneForBodyPart(part);
		let count = 0;
		for (const set of ex.sets) {
			if (!set.completed || !isProgressSet(set)) continue;
			count += 1;
		}
		if (count <= 0) continue;
		map.set(zone, (map.get(zone) ?? 0) + count);
	}
	return map;
}

/** Aggregate per-part set counts across sessions. */
export function mergeSetMaps(maps: readonly Map<string, number>[]): Map<string, number> {
	const out = new Map<string, number>();
	for (const map of maps) {
		for (const [part, count] of map) {
			out.set(part, (out.get(part) ?? 0) + count);
		}
	}
	return out;
}

export function volumeShares(map: Map<string, number>): BodyPartShare[] {
	let total = 0;
	for (const v of map.values()) total += v;
	if (total <= 0) return [];
	const rows: BodyPartShare[] = [];
	for (const [bodyPart, volumeKg] of map) {
		rows.push({
			bodyPart,
			volumeKg,
			sharePct: Math.round((volumeKg / total) * 100)
		});
	}
	rows.sort((a, b) => b.volumeKg - a.volumeKg);
	return rows;
}

export function finishedSessionsWithinDays(
	sessions: readonly WorkoutSession[],
	days: number,
	now: Date = new Date()
): WorkoutSession[] {
	const cutoff = now.getTime() - days * MS_DAY;
	return sessions.filter((s) => {
		if (!s.finishedAt) return false;
		const t = Date.parse(s.finishedAt);
		return Number.isFinite(t) && t >= cutoff;
	});
}

/**
 * Finished sessions in the window `[fromDays, toDays)` days ago - e.g. the
 * previous week: `between(14, 7)`. Used for period-over-period deltas.
 */
export function finishedSessionsBetweenDays(
	sessions: readonly WorkoutSession[],
	fromDays: number,
	toDays: number,
	now: Date = new Date()
): WorkoutSession[] {
	const oldest = now.getTime() - fromDays * MS_DAY;
	const newest = now.getTime() - toDays * MS_DAY;
	return sessions.filter((s) => {
		if (!s.finishedAt) return false;
		const t = Date.parse(s.finishedAt);
		return Number.isFinite(t) && t >= oldest && t < newest;
	});
}

/**
 * Completed working sets per catalog zone over the last week, plus zones the
 * athlete has trained in the longer window but not this week (a real gap, not a
 * muscle they never train). Lowest first: the head of the list is what to add.
 *
 * Sets are the cross-exercise unit training science uses (volume load favours
 * heavy compounds and says nothing about how many hard sets a muscle got), and
 * a weekly window matches how programs are written. The aim of 10+ sets per
 * group per week comes from the dose-response work on weekly volume; it is an
 * orientation, not a verdict.
 */
export function weeklySetsByZone(
	sessions: readonly WorkoutSession[],
	bodyPartFor: (exerciseId: string) => string | null,
	opts: { now?: Date; days?: number; knownDays?: number } = {}
): ZoneWeekSets[] {
	const now = opts.now ?? new Date();
	const days = opts.days ?? 7;
	const knownDays = Math.max(days, opts.knownDays ?? 30);
	const finished = sessions.filter((session) => session.finishedAt);
	const week = mergeSetMaps(
		finishedSessionsWithinDays(finished, days, now).map((session) =>
			sessionSetsByBodyPart(session, bodyPartFor)
		)
	);
	const known = mergeSetMaps(
		finishedSessionsWithinDays(finished, knownDays, now).map((session) =>
			sessionSetsByBodyPart(session, bodyPartFor)
		)
	);
	const zones = new Set([...known.keys(), ...week.keys()]);
	return [...zones]
		.map((bodyPart) => ({ bodyPart, sets: week.get(bodyPart) ?? 0 }))
		.sort((a, b) => a.sets - b.sets || a.bodyPart.localeCompare(b.bodyPart));
}

/** Percent share of set counts, descending by sets. */
export function setShares(map: Map<string, number>): BodyPartSetShare[] {
	let total = 0;
	for (const v of map.values()) total += v;
	if (total <= 0) return [];
	const rows: BodyPartSetShare[] = [];
	for (const [bodyPart, sets] of map) {
		rows.push({ bodyPart, sets, sharePct: Math.round((sets / total) * 100) });
	}
	rows.sort((a, b) => b.sets - a.sets);
	return rows;
}

/**
 * Body parts below fair set-share (100/n), lowest first.
 * Needs ≥2 parts so a single-group log does not look "undertrained".
 */
export function undertrainedBodyParts(
	shares: readonly Pick<BodyPartSetShare, 'bodyPart' | 'sharePct'>[],
	opts?: { limit?: number; fairShareFactor?: number }
): string[] {
	const limit = opts?.limit ?? 3;
	const fairShareFactor = opts?.fairShareFactor ?? 1;
	if (shares.length < 2) return [];
	const fair = (100 / shares.length) * fairShareFactor;
	return [...shares]
		.filter((row) => row.sharePct < fair)
		.sort((a, b) => a.sharePct - b.sharePct || a.bodyPart.localeCompare(b.bodyPart))
		.slice(0, limit)
		.map((row) => row.bodyPart);
}

/** Assisted / machine-support variants rank below free staples for coach picks. */
const ASSISTED_NAME =
	/\b(assisted|support|with support|kneeling|on knees|band[ -]?assisted|smith)\b|с поддержк|на колен|с полотенц/i;

function pickScore(item: CatalogPickItem): number {
	const popularity = item.globalPopularity ?? 0;
	const assisted = ASSISTED_NAME.test(item.name ?? '') ? 40 : 0;
	return popularity * 2 - assisted;
}

export function pickCatalogExerciseForBodyPart(
	catalog: readonly CatalogPickItem[],
	bodyPart: string,
	excludeIds?: ReadonlySet<string>
): string | null {
	// Accepts a catalog zone («Ноги») as well as a raw dataset part («lower legs»),
	// so shares that merge calves into legs can still pick a real exercise.
	const allowed = new Set(zoneBodyParts(bodyPart));
	const candidates = catalog
		.filter((e) => allowed.has(e.body_part))
		.filter((e) => !excludeIds?.has(e.id))
		.sort((a, b) => {
			const diff = pickScore(b) - pickScore(a);
			if (diff !== 0) return diff;
			return a.id.localeCompare(b.id);
		});
	return candidates[0]?.id ?? null;
}

/**
 * Guards the share vocabulary: «Голени» is part of «Ноги» everywhere muscle shares
 * are shown, and an exercise pick accepts the merged zone.
 */
export function runTrainingLoadSelfCheck(): void {
	const makeSession = (id: string, exerciseId: string, sets: number): WorkoutSession => ({
		id,
		planId: null,
		planName: 'Plan',
		startedAt: '2026-02-10T09:00:00.000Z',
		finishedAt: '2026-02-10T10:00:00.000Z',
		exercises: [
			{
				exerciseId,
				targetSets: sets,
				targetReps: 8,
				restSec: 60,
				sets: Array.from({ length: sets }, () => ({
					weightKg: 50,
					reps: 8,
					completed: true,
					kind: 'work' as const
				}))
			}
		]
	});
	const partFor = (id: string): string | null =>
		id === 'calves' ? 'lower legs' : id === 'quads' ? 'upper legs' : 'chest';

	const setsMap = mergeSetMaps([
		sessionSetsByBodyPart(makeSession('s1', 'calves', 2), partFor),
		sessionSetsByBodyPart(makeSession('s2', 'quads', 3), partFor)
	]);
	if (setsMap.get('legs') !== 5) throw new Error(`training load: legs sets ${setsMap.get('legs')}`);
	if (setsMap.has('lower legs')) throw new Error('training load: raw lower legs leaked into shares');

	const volumeMap = sessionVolumeByBodyPart(makeSession('s3', 'calves', 2), partFor);
	if (volumeMap.get('legs') !== 800) throw new Error(`training load: legs volume ${volumeMap.get('legs')}`);

	const catalog: CatalogPickItem[] = [
		{ id: 'calf-raise', body_part: 'lower legs', name: 'standing calf raise', globalPopularity: 10 },
		{ id: 'squat', body_part: 'upper legs', name: 'barbell squat', globalPopularity: 90 }
	];
	if (pickCatalogExerciseForBodyPart(catalog, 'legs') !== 'squat') {
		throw new Error('training load: zone pick must prefer the leg staple');
	}
	if (pickCatalogExerciseForBodyPart(catalog, 'legs', new Set(['squat'])) !== 'calf-raise') {
		throw new Error('training load: zone pick must still reach calves');
	}
	if (pickCatalogExerciseForBodyPart(catalog, 'chest') !== null) {
		throw new Error('training load: zone pick invented a chest exercise');
	}

	// Weekly sets: the metric the summary shows instead of a 30-day share verdict.
	const weekNow = new Date('2026-02-10T12:00:00.000Z');
	const at = (daysAgo: number) => new Date(weekNow.getTime() - daysAgo * MS_DAY).toISOString();
	const warm = makeSession('ww', 'quads', 3);
	warm.exercises[0].sets[0] = { ...warm.exercises[0].sets[0], kind: 'warmup' };
	const weekRows = weeklySetsByZone(
		[
			{ ...makeSession('wa', 'quads', 4), finishedAt: at(2) },
			{ ...makeSession('wb', 'calves', 3), finishedAt: at(1) },
			{ ...warm, finishedAt: at(0) },
			{ ...makeSession('wc', 'chest', 5), finishedAt: at(10) },
			{ ...makeSession('wd', 'curls', 2), finishedAt: at(40) }
		],
		(id) => (id === 'curls' ? 'upper arms' : partFor(id)),
		{ now: weekNow }
	);
	const weekByZone = new Map(weekRows.map((row) => [row.bodyPart, row.sets]));
	if (weekByZone.get('legs') !== 9) {
		throw new Error(`training load: weekly legs sets ${weekByZone.get('legs')} (warmups must not count)`);
	}
	if (weekByZone.get('chest') !== 0) {
		throw new Error('training load: a zone outside the week must stay at zero, not disappear');
	}
	if (weekRows[0]?.bodyPart !== 'chest') {
		throw new Error('training load: the biggest gap must lead the week list');
	}
	if (weekByZone.has('arms')) {
		throw new Error('training load: a zone untouched for 40 days must not invent a weekly row');
	}
}
