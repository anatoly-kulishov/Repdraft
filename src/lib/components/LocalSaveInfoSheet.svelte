<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import { translate } from '$lib/i18n/messages';
	import { auth } from '$lib/stores/auth';
	import { resolvedLocale } from '$lib/stores/locale';

	let {
		open = $bindable(false)
	}: {
		open?: boolean;
	} = $props();

	let lang = $derived($resolvedLocale);
	let signedIn = $derived(!!$auth.user);

	function dismiss() {
		open = false;
	}
</script>

<BottomSheet {open} titleId="local-save-sheet-title" onDismiss={dismiss}>
	<p id="local-save-sheet-title" class="bottom-sheet__title">
		{signedIn
			? translate(lang, 'sync.savedAccountSheetTitle')
			: translate(lang, 'sync.localSaveSheetTitle')}
	</p>
	<p class="bottom-sheet__hint">
		{signedIn
			? translate(lang, 'sync.savedAccountSheetBody')
			: translate(lang, 'sync.localSaveSheetBody')}
	</p>
	{#snippet actions()}
		{#if signedIn}
			<AppButton variant="secondary" onclick={dismiss}>
				{translate(lang, 'onboarding.gotIt')}
			</AppButton>
		{:else}
			<AppButton variant="primary" href="/auth" onclick={dismiss}>
				{translate(lang, 'sync.localSaveSheetCta')}
			</AppButton>
		{/if}
	{/snippet}
</BottomSheet>
