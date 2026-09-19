<script lang="ts">
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { syncState, type LocalSyncState } from '$lib/stores/syncState';
	import { toasts } from '$lib/stores/toasts';
	import { get } from 'svelte/store';
	import { onMount } from 'svelte';

	const LOCAL_SAVE_TOAST_GROUP = 'local-save';

	function emitForStatus(next: LocalSyncState) {
		const lang = get(resolvedLocale);

		// Success is already covered in-context: live cue, builder.savedToast, and
		// "on this device" chrome. A guest upsell toast just adds noise.
		if (next === 'saved') return;

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
