import { writable } from 'svelte/store';

export type OutboxSyncPhase = 'idle' | 'syncing' | 'success' | 'error';

const SUCCESS_HIDE_MS = 3000;

function createOutboxSyncUiStore() {
	const { subscribe, set } = writable<OutboxSyncPhase>('idle');
	let hideTimer: number | undefined;

	function clearHide() {
		if (hideTimer !== undefined) {
			clearTimeout(hideTimer);
			hideTimer = undefined;
		}
	}

	function scheduleHideIdle(ms: number) {
		clearHide();
		if (typeof window === 'undefined') {
			set('idle');
			return;
		}
		hideTimer = window.setTimeout(() => {
			hideTimer = undefined;
			set('idle');
		}, ms);
	}

	return {
		subscribe,
		beginFlush() {
			clearHide();
			set('syncing');
		},
		markFlushSuccess() {
			clearHide();
			set('success');
			scheduleHideIdle(SUCCESS_HIDE_MS);
		},
		markFlushError() {
			clearHide();
			set('error');
		},
		/** Reset without success flash (e.g. empty no-op flush). */
		markFlushIdle() {
			clearHide();
			set('idle');
		}
	};
}

export const outboxSyncUi = createOutboxSyncUiStore();
