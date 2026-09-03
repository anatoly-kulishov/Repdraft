	import {
	ACTIVE_SESSION_KEY,
	SESSIONS_STORAGE_KEY,
	type SessionRepository
} from '$lib/domain/repository';
import { HOME_RECENT_ROW_LIMIT, WORKOUTS_HISTORY_SKELETON_ROW_LIMIT } from '$lib/domain/home';
import type { WorkoutSession } from '$lib/domain/types';

function readSessions(): WorkoutSession[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as WorkoutSession[];
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function writeSessions(sessions: WorkoutSession[]): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
	syncHomeRecentBootDataset();
}

/** Sync peek for loading skeleton row counts. */
export function peekLocalSession(id: string): WorkoutSession | null {
	return readSessions().find((session) => session.id === id) ?? null;
}

/** Finished sessions count for home boot skeleton aside. */
export function peekLocalHistoryCount(): number {
	return readSessions().filter((session) => Boolean(session.finishedAt)).length;
}

/** Keep html dataset in sync so `/` skeleton row count matches before Svelte mounts. */
export function syncHomeRecentBootDataset(): void {
	if (typeof document === 'undefined') return;
	try {
		const historyCount = peekLocalHistoryCount();
		const hasHistory = historyCount > 0;
		const cappedHistoryRows = Math.min(
			Math.max(historyCount, 0),
			WORKOUTS_HISTORY_SKELETON_ROW_LIMIT
		);
		document.documentElement.dataset.homeRecentRows = String(
			hasHistory ? HOME_RECENT_ROW_LIMIT : 0
		);
		document.documentElement.dataset.workoutsHistoryRows = String(cappedHistoryRows);
		if (hasHistory) {
			document.cookie = 'repdraft_home_has_history=1; path=/; Max-Age=31536000; SameSite=Lax';
			document.cookie = `repdraft_workouts_history_rows=${cappedHistoryRows}; path=/; Max-Age=31536000; SameSite=Lax`;
		} else {
			document.cookie = 'repdraft_home_has_history=; path=/; Max-Age=0; SameSite=Lax';
			document.cookie = 'repdraft_workouts_history_rows=0; path=/; Max-Age=31536000; SameSite=Lax';
		}
	} catch {
		/* ignore */
	}
}

/** Keep html dataset in sync so `/` skeleton top matches before Svelte mounts. */
export function syncHomeActiveBootDataset(): void {
	if (typeof document === 'undefined') return;
	try {
		const session = readActiveSession();
		if (session && !session.finishedAt) {
			document.documentElement.dataset.homeActiveSession = '1';
			document.cookie = 'repdraft_home_active=1; path=/; Max-Age=31536000; SameSite=Lax';
		} else {
			delete document.documentElement.dataset.homeActiveSession;
			document.cookie = 'repdraft_home_active=; path=/; Max-Age=0; SameSite=Lax';
		}
	} catch {
		/* ignore */
	}
}

export function readActiveSession(): WorkoutSession | null {
	if (typeof localStorage === 'undefined') return null;
	try {
		const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
		if (!raw) return null;
		return JSON.parse(raw) as WorkoutSession;
	} catch {
		return null;
	}
}

export function writeActiveSession(session: WorkoutSession | null): void {
	if (typeof localStorage === 'undefined') return;
	if (!session) {
		localStorage.removeItem(ACTIVE_SESSION_KEY);
		syncHomeActiveBootDataset();
		return;
	}
	localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
	syncHomeActiveBootDataset();
}

export const localSessionRepository: SessionRepository = {
	async list() {
		return readSessions().sort((a, b) => b.startedAt.localeCompare(a.startedAt));
	},

	async get(id: string) {
		return readSessions().find((s) => s.id === id) ?? null;
	},

	async save(session: WorkoutSession) {
		const list = readSessions();
		const index = list.findIndex((s) => s.id === session.id);
		if (index >= 0) list[index] = session;
		else list.push(session);
		writeSessions(list);
	},

	async remove(id: string) {
		writeSessions(readSessions().filter((s) => s.id !== id));
	}
};

/** Wipe finished sessions; keep any unfinished rows if present. */
export function clearFinishedSessions(): void {
	writeSessions(readSessions().filter((s) => !s.finishedAt));
}

/** Replace entire local sessions list (backup import / cloud merge). */
export function replaceAllSessions(sessions: WorkoutSession[]): void {
	writeSessions(sessions);
}
