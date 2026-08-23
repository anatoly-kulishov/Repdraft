<script lang="ts">
	import AppIconButton from '$lib/components/AppIconButton.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_BUTTON } from '$lib/components/icons/sizes';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { X } from '@lucide/svelte';

	let {
		onclick,
		disabled = false,
		class: className = ''
	}: {
		onclick?: (event: MouseEvent) => void;
		disabled?: boolean;
		class?: string;
	} = $props();

	let lang = $derived($resolvedLocale);
</script>

<AppIconButton {disabled} {onclick} class={className} aria-label={translate(lang, 'a11y.close')}>
	<LucideIcon icon={X} size={ICON_BUTTON} />
</AppIconButton>
