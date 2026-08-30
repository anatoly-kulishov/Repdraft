import { writable } from 'svelte/store';

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
	/** When set, a new toast evicts others in the same group (toggle feedback). */
	replaceGroup?: string;
};

const MAX_TOASTS = 2;
const DEFAULT_MS = 2600;
export const UNDO_MS = 3000;

function createToastStore() {
	const { subscribe, update } = writable<Toast[]>([]);
	let seq = 0;
	const timers = new Map<number, number>();

	function clearTimer(id: number) {
		const timer = timers.get(id);
		if (timer !== undefined) {
			clearTimeout(timer);
			timers.delete(id);
		}
	}

	function scheduleDismiss(id: number, ttl: number) {
		if (typeof window === 'undefined') return;
		clearTimer(id);
		timers.set(
			id,
			window.setTimeout(() => {
				timers.delete(id);
				update((list) => list.filter((t) => t.id !== id));
			}, ttl)
		);
	}

	function push(toast: Omit<Toast, 'id'>, ttl: number) {
		const id = ++seq;
		update((list) => {
			let trimmed = list;
			if (toast.replaceGroup) {
				for (const existing of list) {
					if (existing.replaceGroup === toast.replaceGroup) clearTimer(existing.id);
				}
				trimmed = list.filter((t) => t.replaceGroup !== toast.replaceGroup);
			} else {
				trimmed = list.filter((t) => t.message !== toast.message);
			}
			return [...trimmed, { ...toast, id }].slice(-MAX_TOASTS);
		});
		scheduleDismiss(id, ttl);
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
		showUndo(message: string, onUndo: () => void | Promise<void>, kind: ToastKind = 'info', ms = UNDO_MS) {
			const undoDurationMs = ms;
			const undoExpiresAt = Date.now() + ms;
			push({ message, kind, onUndo, undoExpiresAt, undoDurationMs }, ms);
		},
		dismiss(id: number) {
			clearTimer(id);
			update((list) => list.filter((t) => t.id !== id));
		},
		undo(id: number, onUndo: () => void | Promise<void>) {
			clearTimer(id);
			update((list) => list.filter((t) => t.id !== id));
			void Promise.resolve(onUndo()).catch((err) => {
				console.error('toast undo failed', err);
			});
		}
	};
}

export const toasts = createToastStore();
