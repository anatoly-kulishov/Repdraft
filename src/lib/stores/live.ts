import { browser } from '$app/environment';
import {
	addLoggedSet,
	finishSession,
	lastPerformance,
	mergeWorkoutSessions,
	removeLoggedSet,
	restSecAfterSet,
	startSessionFromPlan,
	syncSessionPrescriptionFromPlan,
	updateLoggedSet
} from '$lib/domain/session';
import type {
	LastPerformance,
	LoggedSet,
	SetKind,
	WorkoutPlan,
	WorkoutSession
} from '$lib/domain/types';
import { REST_SEC } from '$lib/domain/inputLimits';
import { REST_UNTIL_STORAGE_KEY } from '$lib/domain/repository';
import {
	deleteSession,
	isSessionsCloudAvailable,
	persistSession,
	clearFinishedSessionHistory
} from '$lib/storage/dataAccess';
import {
	localSessionRepository,
	readActiveSession,
	writeActiveSession
} from '$lib/storage/localSessionRepository';
import {
	clearSessionTombstone,
	listSessionTombstones
} from '$lib/storage/sessionTombstones';
import { supabaseSessionRepository } from '$lib/storage/supabaseSessionRepository';
import { refreshLocalCloudList } from '$lib/stores/cloudLocal';
import { get, writable } from 'svelte/store';

type LiveState = {
	session: WorkoutSession | null;
	/** Epoch ms when rest ends; null = idle. */
	restUntil: number | null;
	history: WorkoutSession[];
	ready: boolean;
};

const REST_UNTIL_KEY = REST_UNTIL_STORAGE_KEY;

function clampRestUntil(until: number): number | null {
	const leftSec = Math.ceil((until - Date.now()) / 1000);
	if (leftSec <= 0) return null;
	const clamped = Math.min(REST_SEC.max, leftSec);
	return Date.now() + clamped * 1000;
}

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
			const deletedIds = listSessionTombstones();
			const deleted = new Set(deletedIds);
			// Scrub local copies that sync previously resurrected.
			for (const id of deletedIds) {
				try {
					await localSessionRepository.remove(id);
				} catch (err) {
					console.warn('session tombstone local scrub failed', err);
				}
			}
			let cloudSnapshot: WorkoutSession[] = [];
			const result = await refreshLocalCloudList({
				localList: () => localSessionRepository.list(),
				cloudList: () => supabaseSessionRepository.list(),
				merge: (local, cloud) => {
					cloudSnapshot = cloud;
					return mergeWorkoutSessions(local, cloud, deletedIds);
				},
				wantCloud: isSessionsCloudAvailable(),
				label: 'sessions'
			});
			// Always gate UI by tombstones (local-only / cloud-error paths skip merge).
			const finished = result.items.filter((x) => x.finishedAt && !deleted.has(x.id));
			store.update((s) => ({ ...s, history: finished }));

			// Persist cloud-only finished rows so offline “last time” keeps working.
			const localIds = new Set((await localSessionRepository.list()).map((s) => s.id));
			for (const session of finished) {
				if (deleted.has(session.id) || localIds.has(session.id)) continue;
				try {
					await localSessionRepository.save(session);
				} catch (err) {
					console.warn('session local mirror failed', err);
				}
			}

			// Retry cloud deletes; clear tombstone only when cloud list no longer has the id.
			if (isSessionsCloudAvailable() && deletedIds.length > 0) {
				const stillInCloud = new Set(cloudSnapshot.map((s) => s.id));
				for (const id of deletedIds) {
					if (!stillInCloud.has(id)) {
						clearSessionTombstone(id);
						continue;
					}
					try {
						await supabaseSessionRepository.remove(id);
					} catch (err) {
						console.warn('session tombstone cloud delete retry failed', err);
						break;
					}
				}
			}
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
			patch: Partial<Pick<LoggedSet, 'weightKg' | 'reps' | 'completed' | 'kind'>>
		) {
			store.update((s) => {
				if (!s.session) return s;
				const session = updateLoggedSet(s.session, exerciseIndex, setIndex, patch);
				let restUntil = s.restUntil;
				if (patch.completed === true) {
					const sec = restSecAfterSet(session, exerciseIndex, setIndex);
					restUntil = sec > 0 ? Date.now() + sec * 1000 : null;
				}
				persistActive(session, restUntil);
				return { ...s, session, restUntil };
			});
		},
		/** Mark several sets in one write; rest timer uses the last index when completing. */
		setSetsCompleted(exerciseIndex: number, setIndexes: number[], completed: boolean) {
			store.update((s) => {
				if (!s.session || setIndexes.length === 0) return s;
				let session = s.session;
				for (const si of setIndexes) {
					session = updateLoggedSet(session, exerciseIndex, si, { completed });
				}
				let restUntil = s.restUntil;
				if (completed) {
					const lastSi = setIndexes[setIndexes.length - 1]!;
					const sec = restSecAfterSet(session, exerciseIndex, lastSi);
					restUntil = sec > 0 ? Date.now() + sec * 1000 : null;
				} else {
					restUntil = null;
				}
				persistActive(session, restUntil);
				return { ...s, session, restUntil };
			});
		},
		addSet(exerciseIndex: number, kind: SetKind = 'work') {
			store.update((s) => {
				if (!s.session) return s;
				const session = addLoggedSet(s.session, exerciseIndex, kind);
				persistActive(session, s.restUntil);
				return { ...s, session };
			});
		},
		removeSet(exerciseIndex: number, setIndex: number) {
			store.update((s) => {
				if (!s.session) return s;
				const session = removeLoggedSet(s.session, exerciseIndex, setIndex);
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
		/** Nudge active rest by delta seconds (±15). */
		adjustRestSeconds(deltaSec: number) {
			store.update((s) => {
				if (s.restUntil == null) return s;
				const next = clampRestUntil(s.restUntil + deltaSec * 1000);
				persistActive(s.session, next);
				return { ...s, restUntil: next };
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
			store.update((s) => ({
				...s,
				history: s.history.filter((x) => x.id !== id)
			}));
			await deleteSession(id);
			await refreshHistory();
		},
		async clearHistory() {
			store.update((s) => ({ ...s, history: [] }));
			await clearFinishedSessionHistory();
			await refreshHistory();
		},
		lastFor(exerciseId: string): LastPerformance | null {
			return lastPerformance(get(store).history, exerciseId);
		},
		async getFinishedSession(id: string): Promise<WorkoutSession | null> {
			if (listSessionTombstones().includes(id)) return null;
			const fromHistory = get(store).history.find((s) => s.id === id);
			if (fromHistory?.finishedAt) return fromHistory;
			const local = await localSessionRepository.get(id);
			if (local?.finishedAt) return local;
			if (!isSessionsCloudAvailable()) return null;
			try {
				const cloud = await supabaseSessionRepository.get(id);
				if (cloud?.finishedAt) {
					await localSessionRepository.save(cloud);
					return cloud;
				}
			} catch (err) {
				console.warn('getFinishedSession cloud failed', err);
			}
			return null;
		}
	};
}

export const live = createLiveStore();
