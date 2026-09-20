<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import BackupImportAction from '$lib/components/BackupImportAction.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import { AI_DRAFT_HREF, BUILDER_NEW_HREF } from '$lib/domain/catalogLinks';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { Sparkles } from '@lucide/svelte';

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
<AppButton href={BUILDER_NEW_HREF} variant={preferDemo ? 'secondary' : undefined} block>
	{translate(lang, 'workouts.create')}
</AppButton>
<AppButton href={AI_DRAFT_HREF} variant="secondary" block>
	<LucideIcon icon={Sparkles} size={ICON_SMALL} />
	{translate(lang, 'workouts.createWithAi')}
</AppButton>
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
