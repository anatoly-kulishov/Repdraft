<script lang="ts">
	import LocalSaveInfoSheet from '$lib/components/LocalSaveInfoSheet.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import Spinner from '$lib/components/Spinner.svelte';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { syncState } from '$lib/stores/syncState';
	import { Check } from '@lucide/svelte';

	let lang = $derived($resolvedLocale);
	let status = $derived($syncState);
	let sheetOpen = $state(false);

	let visible = $derived(status === 'saving' || status === 'saved' || status === 'error');
	let clickable = $derived(status === 'saved');

	function openSheet() {
		if (!clickable) return;
		sheetOpen = true;
	}
</script>

{#if visible}
	{#if status === 'saving'}
		<span class="live-local-save-cue" role="status" aria-live="polite">
			<Spinner size="sm" block={false} label={translate(lang, 'sync.savingLocally')} />
		</span>
	{:else if status === 'saved'}
		<button
			type="button"
			class="live-local-save-cue live-local-save-cue--saved"
			aria-label={translate(lang, 'sync.savedLocally')}
			onclick={openSheet}
		>
			<LucideIcon icon={Check} size={ICON_SMALL} />
		</button>
	{:else if status === 'error'}
		<span
			class="live-local-save-cue live-local-save-cue--error"
			role="status"
			aria-live="polite"
			title={translate(lang, 'sync.localSaveError')}
		>
			!
		</span>
	{/if}
{/if}

<LocalSaveInfoSheet bind:open={sheetOpen} />
