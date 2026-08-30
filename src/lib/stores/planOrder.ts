import { browser } from '$app/environment';
import { syncPlanOrderIds, moveOrderIds } from '$lib/domain/workout';
import { get, writable } from 'svelte/store';

export const PLAN_ORDER_STORAGE_KEY = 'repdraft:plan-order';

function readOrder(): string[] {
	if (!browser) return [];
	try {
		const raw = localStorage.getItem(PLAN_ORDER_STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		return Array.isArray(parsed)
			? parsed.filter((id): id is string => typeof id === 'string' && id.length > 0)
			: [];
	} catch {
		return [];
	}
}

function writeOrder(order: string[]) {
	if (!browser) return;
	try {
		if (order.length === 0) localStorage.removeItem(PLAN_ORDER_STORAGE_KEY);
		else localStorage.setItem(PLAN_ORDER_STORAGE_KEY, JSON.stringify(order));
	} catch {
		/* ignore */
	}
}

function createPlanOrderStore() {
	const store = writable<string[]>(readOrder());
	const { subscribe, set, update } = store;

	return {
		subscribe,
		setOrder(order: string[]) {
			set(order);
			writeOrder(order);
		},
		syncWithPlanIds(planIds: string[]) {
			const next = syncPlanOrderIds(get(store), planIds);
			set(next);
			writeOrder(next);
			return next;
		},
		move(planId: string, direction: -1 | 1) {
			update((order) => {
				const idx = order.indexOf(planId);
				if (idx < 0) return order;
				const target = idx + direction;
				if (target < 0 || target >= order.length) return order;
				const out = [...order];
				[out[idx], out[target]] = [out[target]!, out[idx]!];
				writeOrder(out);
				return out;
			});
		},
		reorder(fromIndex: number, toIndex: number) {
			update((order) => {
				const out = moveOrderIds(order, fromIndex, toIndex);
				if (out.length !== order.length) return order;
				let changed = false;
				for (let i = 0; i < order.length; i++) {
					if (order[i] !== out[i]) {
						changed = true;
						break;
					}
				}
				if (!changed) return order;
				writeOrder(out);
				return out;
			});
		},
		/** Newly saved plans — top of the user list (not cloud-unknown append). */
		prepend(planId: string) {
			update((order) => {
				const out = [planId, ...order.filter((id) => id !== planId)];
				writeOrder(out);
				return out;
			});
		},
		remove(planId: string) {
			update((order) => {
				const out = order.filter((id) => id !== planId);
				writeOrder(out);
				return out;
			});
		},
		insertAt(planId: string, index: number) {
			update((order) => {
				const out = order.filter((id) => id !== planId);
				const idx = Math.max(0, Math.min(index, out.length));
				out.splice(idx, 0, planId);
				writeOrder(out);
				return out;
			});
		}
	};
}

export const planOrder = createPlanOrderStore();
