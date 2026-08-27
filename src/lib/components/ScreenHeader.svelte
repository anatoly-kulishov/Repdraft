<script lang="ts">
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import { backLabelForHref } from '$lib/i18n/backLabel';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { ArrowLeft } from '@lucide/svelte';

	let {
		title,
		backHref = '/',
		backLabel = null as string | null,
		class: className = '',
		fixed = false,
		actions
	}: {
		title: string;
		backHref?: string;
		backLabel?: string | null;
		class?: string;
		/** Pin to viewport top on mobile sub-routes (long scroll lists). */
		fixed?: boolean;
		actions?: import('svelte').Snippet;
	} = $props();

	let lang = $derived($resolvedLocale);
	let crumbLabel = $derived(backLabel ?? backLabelForHref(backHref, lang));
</script>

<header class="screen-header {className}" class:screen-header--fixed={fixed}>
	<div class="screen-header__bar">
		<a
			href={backHref}
			class="screen-header-crumb"
			aria-label={`${translate(lang, 'a11y.back')}: ${crumbLabel}`}
		>
			<LucideIcon icon={ArrowLeft} size={ICON_SMALL} />
		</a>
		{#if actions}
			<div class="screen-header-actions">
				{@render actions()}
			</div>
		{/if}
	</div>
	<h1 class="screen-header-title">{title}</h1>
</header>
{#if fixed}
	<div class="screen-header-spacer lg:hidden" aria-hidden="true"></div>
{/if}
