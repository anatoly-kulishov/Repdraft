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
	/** When set, a new toast evicts others in the same group (toggle feedback). */
	replaceGroup?: string;
};

const MAX_TOASTS = 2;

function createToastStore() {
	const { subscribe, update } = writable<Toast[]>([]);
	let seq = 0;

	return {
		subscribe,
		show(
			message: string,
			kind: ToastKind = 'info',
			ms = 2600,
			action?: ToastAction,
			replaceGroup?: string
		) {
			const id = ++seq;
			const ttl = action ? Math.max(ms, 4200) : ms;
			update((list) => {
				let trimmed = list;
				if (replaceGroup) {
					trimmed = list.filter((t) => t.replaceGroup !== replaceGroup);
				} else {
					trimmed = list.filter((t) => t.message !== message);
				}
				return [...trimmed, { id, message, kind, action, replaceGroup }].slice(-MAX_TOASTS);
			});
			if (typeof window !== 'undefined') {
				window.setTimeout(() => {
					update((list) => list.filter((t) => t.id !== id));
				}, ttl);
			}
		},
		dismiss(id: number) {
			update((list) => list.filter((t) => t.id !== id));
		}
	};
}

export const toasts = createToastStore();
