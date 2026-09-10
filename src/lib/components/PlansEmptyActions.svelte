<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import BackupImportAction from '$lib/components/BackupImportAction.svelte';
	import { BUILDER_NEW_HREF } from '$lib/domain/catalogLinks';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	let {
		preferDemo = false,
		demoBusy = false,
		onTryDemo
	}: {
		preferDemo?: boolean;
		demoBusy?: boolean;
		onTryDemo: () => void | Promise<void>;
	} = $props();

	let lang = $derived($resolvedLocale);
</script>

{#if preferDemo}
	<AppButton block disabled={demoBusy} aria-busy={demoBusy} onclick={() => void onTryDemo()}>
		{translate(lang, 'onboarding.tryDemo')}
	</AppButton>
{/if}
<AppButton
	href={BUILDER_NEW_HREF}
	variant={preferDemo ? 'secondary' : undefined}
	block
>
	{translate(lang, 'workouts.create')}
</AppButton>
<BackupImportAction variant="secondary" block />
{#if !preferDemo}
	<AppButton
		variant="link"
		block
		class="mt-2"
		disabled={demoBusy}
		aria-busy={demoBusy}
		onclick={() => void onTryDemo()}
	>
		{translate(lang, 'onboarding.emptyPlansDemo')}
	</AppButton>
{/if}
