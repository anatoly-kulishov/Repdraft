import { browser } from '$app/environment';
import { duplicatePlan, mergeWorkoutPlans, sortPlansByUserOrder, withSavedName, workoutPlanContentEqual } from '$lib/domain/workout';
import type { WorkoutPlan } from '$lib/domain/types';
import { clampPlanName } from '$lib/domain/inputLimits';
import { isCloudPersistableId } from '$lib/domain/id';
import { CLOUD_REQUEST_MS } from '$lib/domain/networkTimeouts';
import { withTimeout } from '$lib/domain/withTimeout';
import { translate } from '$lib/i18n/messages';
import { getWorkoutRepo, isCloudMode } from '$lib/storage/dataAccess';
import {
	localWorkoutRepository,
	replaceAllPlans,
	syncHomePlansBootCookie
} from '$lib/storage/localWorkoutRepository';
import { clearLastSyncedAt } from '$lib/storage/syncMeta';
import { supabaseWorkoutRepository } from '$lib/storage/supabaseWorkoutRepository';
import type { CloudSyncState } from '$lib/domain/cloudSync';
import {
	mirrorCloudWrite,
	refreshLocalCloudList
} from '$lib/stores/cloudLocal';
import { writable, get } from 'svelte/store';
import { draft } from './draft';
import { planOrder } from './planOrder';
import { resolvedLocale } from './locale';

	const CLOUD_MS = CLOUD_REQUEST_MS;

	function applyUserOrder(items: WorkoutPlan[]): WorkoutPlan[] {
		const order = planOrder.syncWithPlanIds(items.map((p) => p.id));
		return sortPlansByUserOrder(items, order);
	}

	function createPlansStore() {
	const store = writable<WorkoutPlan[]>([]);
	const ready = writable(false);
	const sync = writable<CloudSyncState>('idle');
	let inflight: Promise<void> | null = null;

	function invalidate() {
		inflight = null;
		store.set([]);
		sync.set('idle');
		ready.set(false);
		clearLastSyncedAt('plans');
	}

	async function refresh(opts?: { cloud?: boolean; force?: boolean }) {
		if (!browser) {
			store.set([]);
			sync.set('synced');
			ready.set(true);
			return;
		}
		// Wait out prior refresh so cloud:false bootstrap cannot swallow a later cloud pull.
		while (inflight) await inflight;

		const wantCloud = opts?.cloud !== false;
		const forceCloud = opts?.force === true;

		const run = (async () => {
			try {
				const result = await refreshLocalCloudList({
					localList: () => localWorkoutRepository.list(),
					cloudList: () => supabaseWorkoutRepository.list(),
					merge: mergeWorkoutPlans,
					wantCloud,
					forceCloud,
					listKey: 'plans',
					previousItems: get(store),
					label: 'plans',
					onUpdate: (update) => {
						store.set(applyUserOrder(update.items));
						sync.set(update.state);
						if (update.state !== 'loading') ready.set(true);
						if (browser) {
							syncHomePlansBootCookie(update.items.length > 0);
						}
					}
				});
				if (wantCloud && result.state === 'synced' && isCloudMode()) {
					replaceAllPlans(result.items);
				}
			} catch (err) {
				console.error('plans.refresh failed', err);
				sync.set('error');
				ready.set(true);
			} finally {
				inflight = null;
			}
		})();

		inflight = run;
		return run;
	}

	return {
		subscribe: store.subscribe,
		ready: { subscribe: ready.subscribe },
		sync: { subscribe: sync.subscribe },
		invalidate,
		refresh,
		async saveCurrent(): Promise<WorkoutPlan> {
			const lang = get(resolvedLocale);
			const draftPlan = get(draft);
			const untitled = translate(lang, 'builder.untitled');
			const existing =
				get(store).find((p) => p.id === draftPlan.id) ??
				(await localWorkoutRepository.get(draftPlan.id));
			if (existing) {
				const namedDraft = {
					...draftPlan,
					name: clampPlanName(draftPlan.name.replace(/\s+/g, ' ').trim()) || untitled
				};
				if (workoutPlanContentEqual(existing, namedDraft)) {
					return existing;
				}
			}
			const current = withSavedName(draftPlan, untitled);
			const isNew =
				!get(store).some((p) => p.id === current.id) &&
				!(await localWorkoutRepository.get(current.id));
			const cloudOk = await mirrorCloudWrite({
				localWrite: () => localWorkoutRepository.save(current),
				cloudWrite: isCloudPersistableId(current.id)
					? () => supabaseWorkoutRepository.save(current)
					: undefined,
				cloudId: current.id,
				label: 'plans.saveCurrent',
				outboxOnFail: isCloudPersistableId(current.id)
					? { kind: 'plan.save', id: current.id }
					: undefined
			});
			if (isNew) planOrder.prepend(current.id);
			await refresh({ cloud: cloudOk && isCloudMode() });
			return current;
		},
		async removePlan(id: string) {
			const cloudOk = await mirrorCloudWrite({
				localWrite: () => localWorkoutRepository.remove(id),
				cloudWrite: isCloudPersistableId(id)
					? () => supabaseWorkoutRepository.remove(id)
					: undefined,
				cloudId: id,
				label: 'plans.removePlan',
				outboxOnFail: isCloudPersistableId(id) ? { kind: 'plan.delete', id } : undefined
			});
			await refresh({ cloud: cloudOk && isCloudMode() });
		},
		async restorePlan(plan: WorkoutPlan, orderIndex = -1) {
			const cloudOk = await mirrorCloudWrite({
				localWrite: () => localWorkoutRepository.save(plan),
				cloudWrite: isCloudPersistableId(plan.id)
					? () => supabaseWorkoutRepository.save(plan)
					: undefined,
				cloudId: plan.id,
				label: 'plans.restorePlan',
				outboxOnFail: isCloudPersistableId(plan.id)
					? { kind: 'plan.save', id: plan.id }
					: undefined
			});
			if (orderIndex >= 0) planOrder.insertAt(plan.id, orderIndex);
			else planOrder.prepend(plan.id);
			await refresh({ cloud: cloudOk && isCloudMode() });
		},
		async duplicate(id: string): Promise<{ plan: WorkoutPlan; synced: boolean } | null> {
			const plan =
				get(store).find((p) => p.id === id) ??
				(await localWorkoutRepository.get(id)) ??
				(await getWorkoutRepo().get(id));
			if (!plan) return null;
			const copy = duplicatePlan(plan, translate(get(resolvedLocale), 'workouts.copySuffix'));
			const synced = await mirrorCloudWrite({
				localWrite: () => localWorkoutRepository.save(copy),
				cloudWrite: isCloudPersistableId(copy.id)
					? () => supabaseWorkoutRepository.save(copy)
					: undefined,
				cloudId: copy.id,
				label: 'plans.duplicate',
				outboxOnFail: isCloudPersistableId(copy.id)
					? { kind: 'plan.save', id: copy.id }
					: undefined
			});
			planOrder.prepend(copy.id);
			await refresh({ cloud: synced && isCloudMode() });
			return { plan: copy, synced: synced || !isCloudMode() };
		},
		async getPlan(id: string): Promise<WorkoutPlan | null> {
			const cached = get(store).find((p) => p.id === id);
			if (cached) return cached;
			const local = await localWorkoutRepository.get(id);
			if (local) return local;
			if (!isCloudPersistableId(id)) return null;
			try {
				return await withTimeout(getWorkoutRepo().get(id), CLOUD_MS);
			} catch {
				return null;
			}
		},
		reorderInOrder(fromIndex: number, toIndex: number) {
			planOrder.reorder(fromIndex, toIndex);
			store.update((items) => sortPlansByUserOrder(items, get(planOrder)));
		}
	};
}

export const plans = createPlansStore();
export const plansReady = { subscribe: plans.ready.subscribe };
export const plansSync = { subscribe: plans.sync.subscribe };
