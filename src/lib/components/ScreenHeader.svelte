<script lang="ts">
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_PRIMARY } from '$lib/components/icons/sizes';
	import { backLabelForHref } from '$lib/i18n/backLabel';
	import { translate } from '$lib/i18n/messages';
	import { navigateBack } from '$lib/navigation/back';
	import { resolvedLocale } from '$lib/stores/locale';
	import { ArrowLeft } from '@lucide/svelte';

	let {
		title,
		backHref = '/',
		backLabel = null as string | null,
		backLabelVisible = false,
		preferHistoryBack = true,
		class: className = '',
		fixed = false,
		actions
	}: {
		title: string;
		backHref?: string;
		backLabel?: string | null;
		/** Show destination text next to the back arrow (e.g. «Тренировки»). */
		backLabelVisible?: boolean;
		/** Match iOS swipe-back: history first, then backHref. */
		preferHistoryBack?: boolean;
		class?: string;
		/** Pin to viewport top on mobile sub-routes (long scroll lists). */
		fixed?: boolean;
		actions?: import('svelte').Snippet;
	} = $props();

	let lang = $derived($resolvedLocale);
	let crumbLabel = $derived(backLabel ?? backLabelForHref(backHref, lang));
</script>

<header
	class="screen-header {className}"
	class:screen-header--fixed={fixed}
	class:screen-header--back-label={backLabelVisible}
>
	<div class="screen-header__bar">
		{#if preferHistoryBack}
			<button
				type="button"
				class="screen-header-crumb"
				class:screen-header-crumb--labeled={backLabelVisible}
				aria-label={`${translate(lang, 'a11y.back')}: ${crumbLabel}`}
				onclick={() => navigateBack(backHref)}
			>
				<LucideIcon icon={ArrowLeft} size={ICON_PRIMARY} />
				{#if backLabelVisible}
					<span class="screen-header-crumb__label">{crumbLabel}</span>
				{/if}
			</button>
		{:else}
			<a
				href={backHref}
				class="screen-header-crumb"
				class:screen-header-crumb--labeled={backLabelVisible}
				aria-label={`${translate(lang, 'a11y.back')}: ${crumbLabel}`}
			>
				<LucideIcon icon={ArrowLeft} size={ICON_PRIMARY} />
				{#if backLabelVisible}
					<span class="screen-header-crumb__label">{crumbLabel}</span>
				{/if}
			</a>
		{/if}
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
