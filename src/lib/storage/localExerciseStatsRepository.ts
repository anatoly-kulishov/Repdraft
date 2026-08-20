import type { UserExerciseStat, UserExerciseStatsMap } from '$lib/domain/exerciseScore';
import { EXERCISE_STATS_STORAGE_KEY } from '$lib/domain/repository';

function readRaw(): UserExerciseStatsMap {
	if (typeof localStorage === 'undefined') return {};
	try {
		const raw = localStorage.getItem(EXERCISE_STATS_STORAGE_KEY);
		if (!raw) return {};
		const parsed = JSON.parse(raw) as unknown;
		if (!parsed || typeof parsed !== 'object') return {};
		const out: UserExerciseStatsMap = {};
		for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
			if (!id || !value || typeof value !== 'object') continue;
			const row = value as { count?: unknown; lastUsedAt?: unknown };
			const count = Number(row.count);
			const lastUsedAt = Number(row.lastUsedAt);
			if (!Number.isFinite(count) || count <= 0) continue;
			out[id] = {
				count: Math.floor(count),
				lastUsedAt: Number.isFinite(lastUsedAt) ? lastUsedAt : 0
			};
		}
		return out;
	} catch {
		return {};
	}
}

function writeRaw(map: UserExerciseStatsMap): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(EXERCISE_STATS_STORAGE_KEY, JSON.stringify(map));
	} catch {
		/* quota */
	}
}

export function readExerciseStats(): UserExerciseStatsMap {
	return readRaw();
}

export function getExerciseStat(exerciseId: string): UserExerciseStat | null {
	return readRaw()[exerciseId] ?? null;
}

/** Bump personal use counter for catalog hybrid ranking. */
export function recordExerciseUse(exerciseId: string, at = Date.now()): UserExerciseStat {
	const map = readRaw();
	const prev = map[exerciseId];
	const next: UserExerciseStat = {
		count: (prev?.count ?? 0) + 1,
		lastUsedAt: at
	};
	map[exerciseId] = next;
	writeRaw(map);
	return next;
}

export function recordExerciseUses(exerciseIds: string[], at = Date.now()): void {
	const unique = [...new Set(exerciseIds.filter(Boolean))];
	if (unique.length === 0) return;
	const map = readRaw();
	for (const id of unique) {
		const prev = map[id];
		map[id] = { count: (prev?.count ?? 0) + 1, lastUsedAt: at };
	}
	writeRaw(map);
}
