/**
 * Watch companion protocol (types only). Phone remains default session master.
 * See `.cursor/product/watch-session-ownership.md`.
 */
import type { WorkoutSession } from './types';

export const WATCH_PROTOCOL_VERSION = 1;

export type SessionLeaseHolder = 'phone' | 'watch';

export type SessionLease = {
	protocolVersion: number;
	sessionId: string;
	planId: string;
	holder: SessionLeaseHolder;
	issuedAt: string;
	expiresAt: string;
};

export type WatchSetDelta = {
	sessionId: string;
	exerciseIndex: number;
	setIndex: number;
	weightKg: number | null;
	reps: number | null;
	completed: boolean;
	clientTimestamp: string;
};

export type WatchFinishRequest = {
	sessionId: string;
	finishedAt: string;
	holder: SessionLeaseHolder;
};

export type WatchSyncPayload = {
	lease: SessionLease | null;
	deltas: WatchSetDelta[];
	finish: WatchFinishRequest | null;
};

/** Apply watch deltas onto phone session (pure). Caller persists. */
export function applyWatchDeltas(
	session: WorkoutSession,
	deltas: WatchSetDelta[]
): WorkoutSession {
	if (deltas.length === 0) return session;
	let next = session;
	for (const d of deltas) {
		if (d.sessionId !== session.id) continue;
		const ex = next.exercises[d.exerciseIndex];
		if (!ex) continue;
		const sets = [...ex.sets];
		while (sets.length <= d.setIndex) {
			sets.push({ weightKg: null, reps: null, completed: false });
		}
		sets[d.setIndex] = {
			weightKg: d.weightKg,
			reps: d.reps,
			completed: d.completed
		};
		const exercises = [...next.exercises];
		exercises[d.exerciseIndex] = { ...ex, sets };
		next = { ...next, exercises };
	}
	return next;
}
