import {
	ACTIVE_SESSION_KEY,
	SESSIONS_STORAGE_KEY,
	type SessionRepository
} from '$lib/domain/repository';
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
}

/** Sync peek for loading skeleton row counts. */
export function peekLocalSession(id: string): WorkoutSession | null {
	return readSessions().find((session) => session.id === id) ?? null;
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
		return;
	}
	localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
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
