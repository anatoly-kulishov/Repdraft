<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	let {
		open = $bindable(false)
	}: {
		open?: boolean;
	} = $props();

	let lang = $derived($resolvedLocale);

	function dismiss() {
		open = false;
	}
</script>

<BottomSheet {open} titleId="local-save-sheet-title" onDismiss={dismiss}>
	<p id="local-save-sheet-title" class="bottom-sheet__title">
		{translate(lang, 'sync.localSaveSheetTitle')}
	</p>
	<p class="bottom-sheet__hint">{translate(lang, 'sync.localSaveSheetBody')}</p>
	{#snippet actions()}
		<AppButton variant="primary" href="/auth" onclick={dismiss}>
			{translate(lang, 'sync.localSaveSheetCta')}
		</AppButton>
	{/snippet}
</BottomSheet>
