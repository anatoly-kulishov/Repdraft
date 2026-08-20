import { browser } from '$app/environment';
import {
	addLoggedSet,
	chooseAltExercise,
	completedSetCount,
	finishSession,
	lastPerformance,
	mergeWorkoutSessions,
	removeLoggedSet,
	restSecAfterSet,
	seedOpenSetsFromLastPerformance,
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
import { exerciseStats } from '$lib/stores/exerciseStats';
import {
	localSessionRepository,
	readActiveSession,
	writeActiveSession
} from '$lib/storage/localSessionRepository';
import {
	addSessionTombstones,
	clearSessionTombstone,
	listSessionTombstones
} from '$lib/storage/sessionTombstones';
import { clearLastSyncedAt } from '$lib/storage/syncMeta';
import { supabaseSessionRepository } from '$lib/storage/supabaseSessionRepository';
import { refreshLocalCloudList } from '$lib/stores/cloudLocal';
import { get, writable } from 'svelte/store';

type LiveState = {
	session: WorkoutSession | null;
	/** Epoch ms when rest ends; null = idle. */
	restUntil: number | null;
	history: WorkoutSession[];
	ready: boolean;
	/** True after first history refresh completes (warm nav skips full-page wait). */
	historyHydrated: boolean;
};

const REST_UNTIL_KEY = REST_UNTIL_STORAGE_KEY;
const AUTO_UNNAMED_SESSION_NAMES = new Set(['', 'тренировка без названия', 'untitled workout']);

function normalizedSessionName(name: string | null | undefined): string {
	return (name ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function isAutoUnnamedSession(session: WorkoutSession): boolean {
	return AUTO_UNNAMED_SESSION_NAMES.has(normalizedSessionName(session.planName));
}

function isJunkUnnamedSession(session: WorkoutSession): boolean {
	return (
		session.finishedAt != null &&
		isAutoUnnamedSession(session) &&
		completedSetCount(session) === 0
	);
}

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
		ready: false,
		historyHydrated: false
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
				listKey: 'sessions',
				previousItems: get(store).history,
				label: 'sessions'
			});
			const unnamedIds = result.items
				.filter((session) => isJunkUnnamedSession(session))
				.map((session) => session.id);
			if (unnamedIds.length > 0) {
				addSessionTombstones(unnamedIds);
				for (const id of unnamedIds) {
					deleted.add(id);
					try {
						await localSessionRepository.remove(id);
					} catch (err) {
						console.warn('unnamed session local scrub failed', err);
					}
				}
			}
			// Always gate UI by tombstones (local-only / cloud-error paths skip merge).
			const finished = result.items.filter((x) => x.finishedAt && !deleted.has(x.id));
			store.update((s) => ({ ...s, history: finished, historyHydrated: true }));

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
			if (isSessionsCloudAvailable() && (deletedIds.length > 0 || unnamedIds.length > 0)) {
				const stillInCloud = new Set(cloudSnapshot.map((s) => s.id));
				for (const id of [...new Set([...deletedIds, ...unnamedIds])]) {
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
			store.update((s) => ({ ...s, historyHydrated: true }));
		}
	}

	function hydrate() {
		if (!browser) {
			store.set({
				session: null,
				restUntil: null,
				history: [],
				ready: true,
				historyHydrated: true
			});
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
		store.update((s) => ({
			session: active && !active.finishedAt ? active : null,
			restUntil,
			history: s.history,
			ready: true,
			historyHydrated: s.historyHydrated
		}));
		void refreshHistory();
	}

	return {
		subscribe: store.subscribe,
		hydrate,
		refreshHistory,
		async startFromPlan(plan: WorkoutPlan): Promise<WorkoutSession> {
			const history = get(store).history;
			const session = seedOpenSetsFromLastPerformance(startSessionFromPlan(plan), (id) =>
				lastPerformance(history, id)
			);
			persistActive(session, null);
			store.update((s) => ({ ...s, session, restUntil: null }));
			void refreshHistory();
			return session;
		},
		resetHistoryHydration() {
			clearLastSyncedAt('sessions');
			store.update((s) => ({ ...s, historyHydrated: false, history: [] }));
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
		chooseAlt(altGroupId: string, exerciseId: string) {
			store.update((s) => {
				if (!s.session) return s;
				const session = chooseAltExercise(s.session, altGroupId, exerciseId);
				persistActive(session, s.restUntil);
				return { ...s, session };
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
			const usedIds = done.exercises
				.filter((ex) => ex.sets.some((s) => s.completed))
				.map((ex) => ex.exerciseId);
			exerciseStats.recordUses(usedIds);
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
		/**
		 * Patch a finished (history) session and persist changes locally + mirror to cloud.
		 * Used for “edit history” UI.
		 */
		async patchFinishedSession(
			id: string,
			updater: (session: WorkoutSession) => WorkoutSession
		): Promise<boolean> {
			// Block resurrecting deleted sessions.
			if (listSessionTombstones().includes(id)) return false;

			let session: WorkoutSession | null = get(store).history.find((s) => s.id === id) ?? null;
			if (!session?.finishedAt) session = await localSessionRepository.get(id);
			if (!session?.finishedAt && isSessionsCloudAvailable()) {
				try {
					const cloud = await supabaseSessionRepository.get(id);
					if (cloud?.finishedAt) {
						// Keep local mirror in sync so offline "last time" uses edits.
						await localSessionRepository.save(cloud);
						session = cloud;
					}
				} catch (err) {
					console.warn('patchFinishedSession cloud failed', err);
				}
			}

			if (!session?.finishedAt) return false;

			const next = updater(session);
			// Safety: keep identity + finished markers intact.
			const patched: WorkoutSession = {
				...next,
				id: session.id,
				startedAt: session.startedAt,
				finishedAt: session.finishedAt
			};

			await persistSession(patched);
			await refreshHistory();
			return true;
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
