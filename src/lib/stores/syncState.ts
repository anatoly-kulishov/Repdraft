import { writable } from 'svelte/store';

export type LocalSyncState = 'idle' | 'saving' | 'saved' | 'error';

const SETTLE_MS = 350;
const SAVED_HIDE_MS = 3000;
const ERROR_HIDE_MS = 4000;

function createSyncStateStore() {
	const { subscribe, set } = writable<LocalSyncState>('idle');
	let inFlight = 0;
	let settleTimer: number | undefined;
	let hideTimer: number | undefined;

	function clearSettle() {
		if (settleTimer !== undefined) {
			clearTimeout(settleTimer);
			settleTimer = undefined;
		}
	}

	function clearHide() {
		if (hideTimer !== undefined) {
			clearTimeout(hideTimer);
			hideTimer = undefined;
		}
	}

	function scheduleHide(next: 'idle', ms: number) {
		clearHide();
		if (typeof window === 'undefined') {
			set(next);
			return;
		}
		hideTimer = window.setTimeout(() => {
			hideTimer = undefined;
			set(next);
		}, ms);
	}

	function scheduleSaved() {
		clearSettle();
		if (typeof window === 'undefined') {
			set('saved');
			scheduleHide('idle', SAVED_HIDE_MS);
			return;
		}
		settleTimer = window.setTimeout(() => {
			settleTimer = undefined;
			if (inFlight > 0) return;
			set('saved');
			scheduleHide('idle', SAVED_HIDE_MS);
		}, SETTLE_MS);
	}

	return {
		subscribe,
		beginLocalSave() {
			clearHide();
			clearSettle();
			inFlight += 1;
			set('saving');
		},
		markLocalSaved() {
			inFlight = Math.max(0, inFlight - 1);
			if (inFlight > 0) {
				set('saving');
				return;
			}
			scheduleSaved();
		},
		markLocalSaveError() {
			inFlight = Math.max(0, inFlight - 1);
			if (inFlight > 0) {
				set('saving');
				return;
			}
			clearSettle();
			set('error');
			scheduleHide('idle', ERROR_HIDE_MS);
		}
	};
}

export const syncState = createSyncStateStore();
