/**
 * Best completed lift per exercise from a finished session → PersonalRecord candidates.
 */
import { sanitizePersonalRecord } from './records';
import type { PersonalRecord, WorkoutSession } from './types';

function isBetter(next: PersonalRecord, prev: PersonalRecord | null): boolean {
	if (!prev) return true;
	const nw = next.weightKg;
	const pw = prev.weightKg;
	if (nw != null && pw != null) {
		if (nw > pw) return true;
		if (nw < pw) return false;
		return (next.reps ?? 0) > (prev.reps ?? 0);
	}
	if (nw != null && pw == null) return true;
	if (nw == null && pw != null) return false;
	return (next.reps ?? 0) > (prev.reps ?? 0);
}

export function recordsFromFinishedSession(session: WorkoutSession): PersonalRecord[] {
	if (!session.finishedAt) return [];
	const out: PersonalRecord[] = [];
	const now = new Date().toISOString();
	for (const ex of session.exercises) {
		if (ex.skipped) continue;
		let bestW: number | null = null;
		let bestR: number | null = null;
		for (const set of ex.sets) {
			if (!set.completed) continue;
			const w = set.weightKg;
			const r = set.reps;
			if (w != null && Number.isFinite(w)) {
				if (bestW == null || w > bestW || (w === bestW && (r ?? 0) > (bestR ?? 0))) {
					bestW = w;
					bestR = r;
				}
			} else if (r != null && Number.isFinite(r) && bestW == null) {
				if (bestR == null || r > bestR) bestR = r;
			}
		}
		if (bestW == null && bestR == null) continue;
		const sanitized = sanitizePersonalRecord({
			exerciseId: ex.exerciseId,
			weightKg: bestW,
			reps: bestR,
			note: '',
			updatedAt: now
		});
		if (sanitized.ok) out.push(sanitized.record);
	}
	return out;
}

export function mergeSessionRecordsInto(
	existing: PersonalRecord[],
	fromSession: PersonalRecord[]
): PersonalRecord[] {
	const map = new Map(existing.map((r) => [r.exerciseId, r]));
	for (const next of fromSession) {
		const prev = map.get(next.exerciseId) ?? null;
		if (isBetter(next, prev)) map.set(next.exerciseId, next);
	}
	return [...map.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** How many session lifts beat the previous stored record. */
export function countImprovedRecords(
	existing: PersonalRecord[],
	fromSession: PersonalRecord[]
): number {
	const map = new Map(existing.map((r) => [r.exerciseId, r]));
	let n = 0;
	for (const next of fromSession) {
		const prev = map.get(next.exerciseId) ?? null;
		if (isBetter(next, prev)) n += 1;
	}
	return n;
}
