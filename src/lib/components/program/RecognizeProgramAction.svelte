<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import RecognizeProgramSheet from '$lib/components/program/RecognizeProgramSheet.svelte';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { Camera } from 'phosphor-svelte';

	let {
		variant = 'secondary',
		block = false,
		class: className = ''
	}: {
		variant?: 'primary' | 'action' | 'secondary' | 'danger' | 'ghost' | 'link';
		block?: boolean;
		class?: string;
	} = $props();

	let lang = $derived($resolvedLocale);
	let open = $state(false);
</script>

<AppButton
	{variant}
	{block}
	class={className}
	onclick={() => {
		open = true;
	}}
>
	<LucideIcon icon={Camera} size={ICON_SMALL} />
	{translate(lang, 'recognize.cta')}
</AppButton>

<RecognizeProgramSheet bind:open />
