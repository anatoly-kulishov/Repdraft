import { vibrateUndoTap } from '$lib/domain/prefs';
import { writable, get } from 'svelte/store';
import { translate } from '$lib/i18n/messages';
import { resolvedLocale } from './locale';

/** One undo snackbar at a time (Telegram delete-chat pattern). */
export const TOAST_UNDO_GROUP = 'undo';

export type ToastKind = 'success' | 'info' | 'error';

export type ToastAction = {
	href: string;
	label: string;
};

export type Toast = {
	id: number;
	message: string;
	kind: ToastKind;
	action?: ToastAction;
	onUndo?: () => void | Promise<void>;
	/** Wall-clock expiry for undo countdown UI. */
	undoExpiresAt?: number;
	undoDurationMs?: number;
	/** Undo action in flight — show spinner, keep toast visible. */
	undoBusy?: boolean;
	/** When set, a new toast evicts others in the same group (toggle feedback). */
	replaceGroup?: string;
};

const DEFAULT_MS = 2600;
export const UNDO_MS = 5000;

type PendingEntry = {
	toast: Toast;
	ttl: number;
};

function isUndoToast(toast: Pick<Toast, 'onUndo'>): boolean {
	return Boolean(toast.onUndo);
}

function createToastStore() {
	const store = writable<Toast[]>([]);
	const { subscribe, update, set } = store;
	let seq = 0;
	const timers = new Map<number, number>();
	let pending: PendingEntry[] = [];

	function clearTimer(id: number) {
		const timer = timers.get(id);
		if (timer !== undefined) {
			clearTimeout(timer);
			timers.delete(id);
		}
	}

	function matchesIncoming(existing: Toast, incoming: Omit<Toast, 'id'> | Toast): boolean {
		if (incoming.replaceGroup) return existing.replaceGroup === incoming.replaceGroup;
		return existing.message === incoming.message;
	}

	function prunePending(incoming: Omit<Toast, 'id'> | Toast) {
		pending = pending.filter((entry) => !matchesIncoming(entry.toast, incoming));
	}

	function scheduleDismiss(id: number, ttl: number) {
		if (typeof window === 'undefined') return;
		clearTimer(id);
		timers.set(
			id,
			window.setTimeout(() => {
				timers.delete(id);
				removeActive(id, true);
			}, ttl)
		);
	}

	function promoteNext(): Toast[] {
		const next = pending.shift();
		if (!next) return [];
		scheduleDismiss(next.toast.id, next.ttl);
		return [next.toast];
	}

	/** Remove the active toast by id; optionally promote the next queued item. */
	function removeActive(id: number, promote: boolean) {
		clearTimer(id);
		update((list) => {
			const filtered = list.filter((t) => t.id !== id);
			if (filtered.length > 0) return filtered;
			if (!promote) return [];
			return promoteNext();
		});
	}

	function readActive(): Toast | null {
		return get(store)[0] ?? null;
	}

	function push(toast: Omit<Toast, 'id'>, ttl: number) {
		const id = ++seq;
		const next: Toast = { ...toast, id };
		const active = readActive();

		prunePending(toast);

		if (active && matchesIncoming(active, toast)) {
			clearTimer(active.id);
			set([next]);
			scheduleDismiss(id, ttl);
			return id;
		}

		if (!active) {
			set([next]);
			scheduleDismiss(id, ttl);
			return id;
		}

		const incomingUndo = isUndoToast(next);
		const activeUndo = isUndoToast(active);

		// Displace: new undo always; normal displaces normal.
		if (incomingUndo || !activeUndo) {
			clearTimer(active.id);
			if (incomingUndo) {
				// Fresh undo window: drop queued normals that would steal focus after.
				pending = [];
			}
			set([next]);
			scheduleDismiss(id, ttl);
			return id;
		}

		// Active undo + normal toast → enqueue (do not interrupt undo).
		pending.push({ toast: next, ttl });
		return id;
	}

	return {
		subscribe,
		show(
			message: string,
			kind: ToastKind = 'info',
			ms = DEFAULT_MS,
			action?: ToastAction,
			replaceGroup?: string
		) {
			const ttl = action ? Math.max(ms, 4200) : ms;
			push({ message, kind, action, replaceGroup }, ttl);
		},
		showUndo(
			message: string,
			onUndo: () => void | Promise<void>,
			kind: ToastKind = 'info',
			ms = UNDO_MS,
			replaceGroup: string = TOAST_UNDO_GROUP
		) {
			const undoDurationMs = ms;
			const undoExpiresAt = Date.now() + ms;
			push({ message, kind, onUndo, undoExpiresAt, undoDurationMs, replaceGroup }, ms);
		},
		dismiss(id: number) {
			removeActive(id, true);
		},
		undo(id: number, onUndo: () => void | Promise<void>) {
			vibrateUndoTap();
			clearTimer(id);
			update((list) =>
				list.map((t) =>
					t.id === id ? { ...t, undoBusy: true, undoExpiresAt: undefined } : t
				)
			);
			void Promise.resolve(onUndo())
				.then(() => {
					removeActive(id, true);
				})
				.catch((err) => {
					console.error('toast undo failed', err);
					// Keep pending; show failure as the new active toast.
					removeActive(id, false);
					const lang = get(resolvedLocale);
					push(
						{ message: translate(lang, 'toast.undoFail'), kind: 'error' },
						DEFAULT_MS
					);
				});
		}
	};
}

export const toasts = createToastStore();
