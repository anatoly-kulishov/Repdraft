<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import BackupImportAction from '$lib/components/BackupImportAction.svelte';
	import RecognizeProgramAction from '$lib/components/program/RecognizeProgramAction.svelte';
	import { MetalFx } from '$lib/components/fx';
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
	<MetalFx class="w-full">
		<AppButton
			block
			disabled={demoBusy}
			aria-busy={demoBusy}
			class="fx-cta-sheen"
			onclick={() => void onTryDemo()}
		>
			{translate(lang, 'onboarding.tryDemo')}
		</AppButton>
	</MetalFx>
{/if}
{#if preferDemo}
	<AppButton href={BUILDER_NEW_HREF} variant="secondary" block>
		{translate(lang, 'workouts.create')}
	</AppButton>
{:else}
	<MetalFx class="w-full">
		<AppButton href={BUILDER_NEW_HREF} block class="fx-cta-sheen">
			{translate(lang, 'workouts.create')}
		</AppButton>
	</MetalFx>
{/if}
<RecognizeProgramAction variant="ghost" block />
{#if !preferDemo}
	<AppButton
		variant="secondary"
		block
		disabled={demoBusy}
		aria-busy={demoBusy}
		onclick={() => void onTryDemo()}
	>
		{translate(lang, 'onboarding.tryDemo')}
	</AppButton>
{/if}
<BackupImportAction variant="link" block class="plans-empty-restore-link" />
