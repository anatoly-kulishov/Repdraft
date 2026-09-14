<script lang="ts">
	import { translate } from '$lib/i18n/messages';
	import { outboxCount } from '$lib/storage/syncOutbox';
	import { auth } from '$lib/stores/auth';
	import { resolvedLocale } from '$lib/stores/locale';
	import { outboxSyncUi } from '$lib/stores/outboxSyncUi';
	import { syncState, type LocalSyncState } from '$lib/stores/syncState';
	import { toasts } from '$lib/stores/toasts';
	import { get } from 'svelte/store';
	import { onMount } from 'svelte';

	const LOCAL_SAVE_TOAST_GROUP = 'local-save';

	/** Cloud snackbar already covers pending / flush / offline in the same band. */
	function cloudCueOwnsFeedback(): boolean {
		if (get(outboxSyncUi) !== 'idle') return true;
		if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
		return outboxCount() > 0;
	}

	function emitForStatus(next: LocalSyncState) {
		const lang = get(resolvedLocale);
		const signedIn = Boolean(get(auth).user);

		if (next === 'saved') {
			if (cloudCueOwnsFeedback()) return;
			const message = signedIn
				? translate(lang, 'sync.saved')
				: translate(lang, 'sync.savedLocally');
			toasts.show(
				message,
				'success',
				2600,
				signedIn
					? undefined
					: { href: '/auth', label: translate(lang, 'sync.localSaveSheetCta') },
				LOCAL_SAVE_TOAST_GROUP
			);
			return;
		}

		if (next === 'error') {
			toasts.show(
				translate(lang, 'sync.localSaveError'),
				'error',
				4000,
				undefined,
				LOCAL_SAVE_TOAST_GROUP
			);
		}
	}

	onMount(() => {
		let prev = get(syncState);
		return syncState.subscribe((next) => {
			if (next === prev) return;
			prev = next;
			emitForStatus(next);
		});
	});
</script>
