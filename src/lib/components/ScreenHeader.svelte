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
		fixed = false,
		actions
	}: {
		title: string;
		backHref?: string;
		class?: string;
		/** Pin to viewport top on mobile sub-routes (long scroll lists). */
		fixed?: boolean;
		actions?: import('svelte').Snippet;
	} = $props();

	let lang = $derived($resolvedLocale);
</script>

<header class="screen-header {className}" class:screen-header--fixed={fixed}>
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
{#if fixed}
	<div class="screen-header-spacer lg:hidden" aria-hidden="true"></div>
{/if}
