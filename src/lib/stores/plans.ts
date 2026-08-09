import { browser } from '$app/environment';
import { duplicatePlan, mergeWorkoutPlans, withSavedName } from '$lib/domain/workout';
import type { WorkoutPlan } from '$lib/domain/types';
import { withTimeout } from '$lib/domain/withTimeout';
import { translate } from '$lib/i18n/messages';
import { getWorkoutRepo, isCloudMode } from '$lib/storage/dataAccess';
import { localWorkoutRepository } from '$lib/storage/localWorkoutRepository';
import { supabaseWorkoutRepository } from '$lib/storage/supabaseWorkoutRepository';
import { writable, get } from 'svelte/store';
import { draft } from './draft';
import { resolvedLocale } from './locale';

const CLOUD_MS = 4000;

function createPlansStore() {
	const store = writable<WorkoutPlan[]>([]);
	const ready = writable(false);
	let inflight: Promise<void> | null = null;

	async function refresh(opts?: { cloud?: boolean }) {
		if (!browser) {
			store.set([]);
			ready.set(true);
			return;
		}
		if (inflight) return inflight;

		const wantCloud = opts?.cloud !== false;

		inflight = (async () => {
			try {
				const local = await localWorkoutRepository.list();
				// Always paint local first so a just-saved plan is visible on /workouts.
				store.set(local);
				ready.set(true);

				if (wantCloud && isCloudMode()) {
					try {
						const cloud = await withTimeout(supabaseWorkoutRepository.list(), CLOUD_MS);
						store.set(mergeWorkoutPlans(local, cloud));
					} catch (err) {
						console.warn('plans cloud refresh failed', err);
						// Keep local — never wipe a successful on-device save.
					}
				}
			} catch (err) {
				console.error('plans.refresh failed', err);
				store.set([]);
			} finally {
				ready.set(true);
				inflight = null;
			}
		})();

		return inflight;
	}

	return {
		subscribe: store.subscribe,
		ready: { subscribe: ready.subscribe },
		refresh,
		async saveCurrent(): Promise<WorkoutPlan> {
			const lang = get(resolvedLocale);
			const current = withSavedName(get(draft), translate(lang, 'builder.untitled'));
			// Local-first: flaky cloud must not block a durable save on device.
			await localWorkoutRepository.save(current);
			let cloudOk = !isCloudMode();
			if (isCloudMode()) {
				try {
					await withTimeout(supabaseWorkoutRepository.save(current), CLOUD_MS);
					cloudOk = true;
				} catch (err) {
					console.warn('plans.saveCurrent cloud failed', err);
					cloudOk = false;
				}
			}
			// If cloud failed, skip cloud list (it may be empty/stale and used to wipe the UI).
			await refresh({ cloud: cloudOk && isCloudMode() });
			return current;
		},
		async removePlan(id: string) {
			await localWorkoutRepository.remove(id);
			let cloudOk = !isCloudMode();
			if (isCloudMode()) {
				try {
					await withTimeout(supabaseWorkoutRepository.remove(id), CLOUD_MS);
					cloudOk = true;
				} catch (err) {
					console.warn('plans.removePlan cloud failed', err);
					cloudOk = false;
				}
			}
			await refresh({ cloud: cloudOk && isCloudMode() });
		},
		async duplicate(id: string): Promise<{ plan: WorkoutPlan; synced: boolean } | null> {
			const plan =
				get(store).find((p) => p.id === id) ??
				(await localWorkoutRepository.get(id)) ??
				(await getWorkoutRepo().get(id));
			if (!plan) return null;
			const copy = duplicatePlan(plan, translate(get(resolvedLocale), 'workouts.copySuffix'));
			// Always durable locally first - cloud can fail on LAN / flaky network.
			await localWorkoutRepository.save(copy);
			let synced = !isCloudMode();
			if (isCloudMode()) {
				try {
					await withTimeout(supabaseWorkoutRepository.save(copy), CLOUD_MS);
					synced = true;
				} catch (err) {
					console.warn('plans.duplicate cloud failed', err);
					synced = false;
				}
			}
			await refresh({ cloud: synced && isCloudMode() });
			return { plan: copy, synced };
		},
		async getPlan(id: string): Promise<WorkoutPlan | null> {
			const cached = get(store).find((p) => p.id === id);
			if (cached) return cached;
			const local = await localWorkoutRepository.get(id);
			if (local) return local;
			try {
				return await withTimeout(getWorkoutRepo().get(id), CLOUD_MS);
			} catch {
				return null;
			}
		}
	};
}

export const plans = createPlansStore();
export const plansReady = { subscribe: plans.ready.subscribe };
