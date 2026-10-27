/** Group finished (or started) sessions by local calendar day for history timelines. */

export type DaySessionGroup<T> = {
	/** Local YYYY-MM-DD of the session day. */
	dayKey: string;
	/** ISO timestamp used for the day label (first session in the group). */
	dayIso: string;
	sessions: T[];
};

function localDayKey(iso: string): string {
	const d = new Date(iso);
	if (!Number.isFinite(d.getTime())) return iso.slice(0, 10);
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

function sessionDayIso(session: { finishedAt?: string | null; startedAt: string }): string {
	return session.finishedAt || session.startedAt;
}

/**
 * Groups sessions already sorted newest-first into local-day sections.
 * Does not re-sort within a day; preserves input order.
 */
export function groupSessionsByLocalDay<T extends { finishedAt?: string | null; startedAt: string }>(
	sessions: readonly T[]
): DaySessionGroup<T>[] {
	const groups: DaySessionGroup<T>[] = [];
	const indexByKey = new Map<string, number>();
	for (const session of sessions) {
		const iso = sessionDayIso(session);
		const dayKey = localDayKey(iso);
		const existing = indexByKey.get(dayKey);
		if (existing != null) {
			groups[existing]!.sessions.push(session);
			continue;
		}
		indexByKey.set(dayKey, groups.length);
		groups.push({ dayKey, dayIso: iso, sessions: [session] });
	}
	return groups;
}
