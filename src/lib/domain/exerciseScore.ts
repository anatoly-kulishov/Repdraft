export type UserExerciseStat = {
	count: number;
	lastUsedAt: number;
};

export type UserExerciseStatsMap = Record<string, UserExerciseStat>;

const RECENCY_MS = 14 * 86400000;

/** Hybrid catalog score: global popularity + personal use + recency. */
export function getScore(
	ex: { globalPopularity?: number },
	stats?: UserExerciseStat | null,
	now = Date.now()
): number {
	const global = (ex.globalPopularity ?? 25) * 0.3;
	const count = (stats?.count || 0) * 10;
	const isRecent = Boolean(stats?.lastUsedAt && now - stats.lastUsedAt < RECENCY_MS);
	const recency = isRecent ? 20 : 0;
	return global + count + recency;
}

export function sortByScore<T extends { id: string; globalPopularity?: number }>(
	items: T[],
	statsMap: UserExerciseStatsMap,
	now = Date.now()
): T[] {
	return [...items].sort((a, b) => {
		const diff = getScore(b, statsMap[b.id], now) - getScore(a, statsMap[a.id], now);
		if (diff !== 0) return diff;
		return a.id.localeCompare(b.id);
	});
}

export function sortByPopularity<T extends { id: string; globalPopularity?: number }>(
	items: T[]
): T[] {
	return [...items].sort((a, b) => {
		const diff = (b.globalPopularity ?? 0) - (a.globalPopularity ?? 0);
		if (diff !== 0) return diff;
		return a.id.localeCompare(b.id);
	});
}

/** Exercises the user has used at least once, highest personal score first. */
export function pickFrequent<T extends { id: string; globalPopularity?: number }>(
	items: T[],
	statsMap: UserExerciseStatsMap,
	limit = 12,
	now = Date.now()
): T[] {
	const used = items.filter((ex) => (statsMap[ex.id]?.count ?? 0) > 0);
	return sortByScore(used, statsMap, now).slice(0, limit);
}

/** Gym staples by globalPopularity, excluding ids already shown. */
export function pickPopular<T extends { id: string; globalPopularity?: number }>(
	items: T[],
	excludeIds: Set<string>,
	limit = 12
): T[] {
	return sortByPopularity(items.filter((ex) => !excludeIds.has(ex.id))).slice(0, limit);
}

export function runExerciseScoreSelfCheck(): void {
	const base = { globalPopularity: 100 };
	if (getScore(base) !== 30) throw new Error('getScore global only');
	if (getScore(base, { count: 2, lastUsedAt: 0 }) !== 50) throw new Error('getScore count');
	const recent = Date.now();
	if (getScore(base, { count: 1, lastUsedAt: recent }, recent) !== 60) {
		throw new Error('getScore recency');
	}
	const sorted = sortByPopularity([
		{ id: 'a', globalPopularity: 10 },
		{ id: 'b', globalPopularity: 90 }
	]);
	if (sorted[0]?.id !== 'b') throw new Error('sortByPopularity');
}
