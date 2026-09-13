import { writable } from 'svelte/store';
import type { LocalMergeChoice } from '$lib/domain/localMergeConflict';

export type LocalMergeConflictStatus = 'idle' | 'pending' | 'resolving';

type LocalMergeConflictState = {
	status: LocalMergeConflictStatus;
};

function createLocalMergeConflictStore() {
	const { subscribe, set } = writable<LocalMergeConflictState>({ status: 'idle' });
	let resolver: ((choice: LocalMergeChoice) => void) | null = null;

	return {
		subscribe,
		/** Open the chooser and wait for Merge or Discard. */
		awaitChoice(): Promise<LocalMergeChoice> {
			return new Promise((resolve) => {
				resolver = resolve;
				set({ status: 'pending' });
			});
		},
		resolve(choice: LocalMergeChoice) {
			const pending = resolver;
			resolver = null;
			set({ status: 'resolving' });
			pending?.(choice);
			set({ status: 'idle' });
		}
	};
}

export const localMergeConflict = createLocalMergeConflictStore();
