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

	let visible = $derived(status !== 'idle');
	let clickable = $derived(status === 'saved');

	function openSheet() {
		if (!clickable) return;
		sheetOpen = true;
	}
</script>

{#if visible}
	<div class="network-status-chip local-save-chip" class:local-save-chip--interactive={clickable}>
		{#if status === 'saving'}
			<div class="local-save-chip__pill" role="status" aria-live="polite">
				<Spinner size="sm" block={false} label={translate(lang, 'sync.savingLocally')} />
			</div>
		{:else if status === 'saved'}
			<button
				type="button"
				class="local-save-chip__pill local-save-chip__pill--saved"
				aria-label={translate(lang, 'sync.savedLocally')}
				onclick={openSheet}
			>
				<span class="local-save-chip__icon" aria-hidden="true">
					<LucideIcon icon={Check} size={ICON_SMALL} />
				</span>
				<span class="local-save-chip__label">{translate(lang, 'sync.savedLocally')}</span>
			</button>
		{:else if status === 'error'}
			<div class="local-save-chip__pill local-save-chip__pill--error" role="status" aria-live="polite">
				<span class="local-save-chip__label">{translate(lang, 'sync.localSaveError')}</span>
			</div>
		{/if}
	</div>
{/if}

<LocalSaveInfoSheet bind:open={sheetOpen} />
