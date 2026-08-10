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
			action?: ToastAction
		) {
			const id = ++seq;
			const ttl = action ? Math.max(ms, 4200) : ms;
			update((list) => {
				// Replace same copy instead of stacking into the middle of the screen.
				const withoutDup = list.filter((t) => t.message !== message);
				return [...withoutDup, { id, message, kind, action }].slice(-MAX_TOASTS);
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
