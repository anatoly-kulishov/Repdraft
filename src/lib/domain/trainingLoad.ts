/**
 * Volume by catalog body_part for summary / coach hints.
 * Pure domain - no UI.
 */
import type { WorkoutSession } from './types';
import { visibleSessionExerciseIndices } from './session';

const MS_DAY = 86_400_000;

export type BodyPartShare = {
	bodyPart: string;
	volumeKg: number;
	sharePct: number;
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
		let vol = 0;
		for (const set of ex.sets) {
			if (!set.completed) continue;
			vol += setVolumeKg(set.weightKg, set.reps);
		}
		if (vol <= 0) continue;
		map.set(part, (map.get(part) ?? 0) + vol);
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

/** Parts strong in the window but weak or missing today (for "lagging" hints). */
export function laggingBodyParts(
	today: Map<string, number>,
	window: Map<string, number>,
	opts?: { minWindowSharePct?: number; maxTodaySharePct?: number }
): string[] {
	const minWindow = opts?.minWindowSharePct ?? 8;
	const maxToday = opts?.maxTodaySharePct ?? 4;
	const windowShares = volumeShares(window);
	const todayShares = volumeShares(today);
	const todayByPart = new Map(todayShares.map((r) => [r.bodyPart, r.sharePct]));
	const lagging: string[] = [];
	for (const row of windowShares) {
		if (row.sharePct < minWindow) continue;
		const todayPct = todayByPart.get(row.bodyPart) ?? 0;
		if (todayPct <= maxToday) lagging.push(row.bodyPart);
	}
	return lagging.slice(0, 3);
}

export function pickCatalogExerciseForBodyPart(
	catalog: readonly { id: string; body_part: string }[],
	bodyPart: string,
	excludeIds?: ReadonlySet<string>
): string | null {
	const candidates = catalog
		.filter((e) => e.body_part === bodyPart)
		.filter((e) => !excludeIds?.has(e.id))
		.sort((a, b) => a.id.localeCompare(b.id));
	return candidates[0]?.id ?? null;
}
