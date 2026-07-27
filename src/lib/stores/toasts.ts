import { writable } from 'svelte/store';

export type ToastKind = 'success' | 'info' | 'error';

export type Toast = {
	id: number;
	message: string;
	kind: ToastKind;
};

function createToastStore() {
	const { subscribe, update } = writable<Toast[]>([]);
	let seq = 0;

	return {
		subscribe,
		show(message: string, kind: ToastKind = 'info', ms = 2600) {
			const id = ++seq;
			update((list) => [...list, { id, message, kind }]);
			if (typeof window !== 'undefined') {
				window.setTimeout(() => {
					update((list) => list.filter((t) => t.id !== id));
				}, ms);
			}
		},
		dismiss(id: number) {
			update((list) => list.filter((t) => t.id !== id));
		}
	};
}

export const toasts = createToastStore();
