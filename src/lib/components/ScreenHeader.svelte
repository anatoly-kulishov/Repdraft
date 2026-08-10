<script lang="ts">
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_BUTTON } from '$lib/components/icons/sizes';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { ArrowLeft } from '@lucide/svelte';

	let {
		title,
		backHref = '/',
		class: className = '',
		actions
	}: {
		title: string;
		backHref?: string;
		class?: string;
		actions?: import('svelte').Snippet;
	} = $props();

	let lang = $derived($resolvedLocale);
</script>

<header class="screen-header {className}">
	<a href={backHref} class="screen-header-back" aria-label={translate(lang, 'a11y.back')}>
		<LucideIcon icon={ArrowLeft} size={ICON_BUTTON + 2} />
	</a>
	<h1 class="screen-header-title">{title}</h1>
	{#if actions}
		<div class="screen-header-actions">
			{@render actions()}
		</div>
	{/if}
</header>
