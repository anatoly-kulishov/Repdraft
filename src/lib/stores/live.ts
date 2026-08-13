import { browser } from '$app/environment';
import {
	addLoggedSet,
	finishSession,
	lastPerformance,
	restSecAfterSet,
	startSessionFromPlan,
	syncSessionPrescriptionFromPlan,
	updateLoggedSet
} from '$lib/domain/session';
import type { LastPerformance, LoggedSet, WorkoutPlan, WorkoutSession } from '$lib/domain/types';
import { REST_UNTIL_STORAGE_KEY } from '$lib/domain/repository';
import { deleteSession, persistSession, clearFinishedSessionHistory } from '$lib/storage/dataAccess';
import {
	localSessionRepository,
	readActiveSession,
	writeActiveSession
} from '$lib/storage/localSessionRepository';
import { get, writable } from 'svelte/store';

type LiveState = {
	session: WorkoutSession | null;
	/** Epoch ms when rest ends; null = idle. */
	restUntil: number | null;
	history: WorkoutSession[];
	ready: boolean;
};

const REST_UNTIL_KEY = REST_UNTIL_STORAGE_KEY;

function createLiveStore() {
	const store = writable<LiveState>({
		session: null,
		restUntil: null,
		history: [],
		ready: false
	});

	function persistActive(session: WorkoutSession | null, restUntil: number | null) {
		writeActiveSession(session);
		if (typeof localStorage === 'undefined') return;
		if (restUntil == null) localStorage.removeItem(REST_UNTIL_KEY);
		else localStorage.setItem(REST_UNTIL_KEY, String(restUntil));
	}

	async function refreshHistory() {
		if (!browser) return;
		try {
			const list = await localSessionRepository.list();
			store.update((s) => ({ ...s, history: list.filter((x) => x.finishedAt) }));
		} catch (err) {
			console.error('live.refreshHistory failed', err);
		}
	}

	function hydrate() {
		if (!browser) {
			store.set({ session: null, restUntil: null, history: [], ready: true });
			return;
		}
		const active = readActiveSession();
		let restUntil: number | null = null;
		try {
			const raw = localStorage.getItem(REST_UNTIL_KEY);
			if (raw) {
				const n = Number(raw);
				restUntil = Number.isFinite(n) && n > Date.now() ? n : null;
			}
		} catch {
			restUntil = null;
		}
		store.set({
			session: active && !active.finishedAt ? active : null,
			restUntil,
			history: [],
			ready: true
		});
		void refreshHistory();
	}

	return {
		subscribe: store.subscribe,
		hydrate,
		refreshHistory,
		async startFromPlan(plan: WorkoutPlan): Promise<WorkoutSession> {
			const session = startSessionFromPlan(plan);
			persistActive(session, null);
			store.update((s) => ({ ...s, session, restUntil: null }));
			return session;
		},
		/** Merge plan prescription (groupId/rest/targets) into the active session. */
		syncFromPlan(plan: WorkoutPlan): WorkoutSession | null {
			const current = get(store).session;
			if (!current || current.finishedAt) return current;
			const session = syncSessionPrescriptionFromPlan(current, plan);
			if (session === current) return current;
			const restUntil = get(store).restUntil;
			persistActive(session, restUntil);
			store.update((s) => ({ ...s, session }));
			return session;
		},
		patchSet(
			exerciseIndex: number,
			setIndex: number,
			patch: Partial<Pick<LoggedSet, 'weightKg' | 'reps' | 'completed'>>
		) {
			store.update((s) => {
				if (!s.session) return s;
				const session = updateLoggedSet(s.session, exerciseIndex, setIndex, patch);
				let restUntil = s.restUntil;
				if (patch.completed === true) {
					const sec = restSecAfterSet(session, exerciseIndex);
					restUntil = sec > 0 ? Date.now() + sec * 1000 : null;
				}
				persistActive(session, restUntil);
				return { ...s, session, restUntil };
			});
		},
		addSet(exerciseIndex: number) {
			store.update((s) => {
				if (!s.session) return s;
				const session = addLoggedSet(s.session, exerciseIndex);
				persistActive(session, s.restUntil);
				return { ...s, session };
			});
		},
		skipRest() {
			store.update((s) => {
				persistActive(s.session, null);
				return { ...s, restUntil: null };
			});
		},
		async finish(): Promise<WorkoutSession | null> {
			const current = get(store).session;
			if (!current) return null;
			const done = finishSession(current);
			await persistSession(done);
			persistActive(null, null);
			await refreshHistory();
			store.update((s) => ({ ...s, session: null, restUntil: null }));
			return done;
		},
		discard() {
			persistActive(null, null);
			store.update((s) => ({ ...s, session: null, restUntil: null }));
		},
		async removeFromHistory(id: string) {
			await deleteSession(id);
			await refreshHistory();
		},
		async clearHistory() {
			await clearFinishedSessionHistory();
			await refreshHistory();
		},
		lastFor(exerciseId: string): LastPerformance | null {
			return lastPerformance(get(store).history, exerciseId);
		},
		async getFinishedSession(id: string): Promise<WorkoutSession | null> {
			const fromHistory = get(store).history.find((s) => s.id === id);
			if (fromHistory?.finishedAt) return fromHistory;
			const local = await localSessionRepository.get(id);
			if (local?.finishedAt) return local;
			return null;
		}
	};
}

export const live = createLiveStore();
