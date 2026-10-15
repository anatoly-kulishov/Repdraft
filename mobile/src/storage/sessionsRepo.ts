import {
	ACTIVE_SESSION_KEY,
	SESSIONS_STORAGE_KEY,
	type SessionRepository
} from '@repdraft/domain/repository';
import type { WorkoutSession } from '@repdraft/domain/types';
import { kvGetJson, kvRemove, kvSetJson } from './kv';

async function readHistory(): Promise<WorkoutSession[]> {
	const list = await kvGetJson<WorkoutSession[]>(SESSIONS_STORAGE_KEY, []);
	return Array.isArray(list) ? list : [];
}

async function writeHistory(sessions: WorkoutSession[]): Promise<void> {
	await kvSetJson(SESSIONS_STORAGE_KEY, sessions);
}

export const sessionsRepo: SessionRepository = {
	async list() {
		const list = await readHistory();
		return [...list].sort((a, b) =>
			(b.finishedAt ?? b.startedAt).localeCompare(a.finishedAt ?? a.startedAt)
		);
	},
	async get(id) {
		return (await readHistory()).find((s) => s.id === id) ?? null;
	},
	async save(session) {
		const list = await readHistory();
		const idx = list.findIndex((s) => s.id === session.id);
		if (idx >= 0) list[idx] = session;
		else list.unshift(session);
		await writeHistory(list);
	},
	async remove(id) {
		await writeHistory((await readHistory()).filter((s) => s.id !== id));
	}
};

export async function readActiveSession(): Promise<WorkoutSession | null> {
	return kvGetJson<WorkoutSession | null>(ACTIVE_SESSION_KEY, null);
}

export async function writeActiveSession(session: WorkoutSession | null): Promise<void> {
	if (!session) {
		await kvRemove(ACTIVE_SESSION_KEY);
		return;
	}
	await kvSetJson(ACTIVE_SESSION_KEY, session);
}
