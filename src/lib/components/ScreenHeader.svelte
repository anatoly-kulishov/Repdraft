<script lang="ts">
	import ExpandableText from '$lib/components/ExpandableText.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_PRIMARY } from '$lib/components/icons/sizes';
	import { backLabelForHref } from '$lib/i18n/backLabel';
	import { translate } from '$lib/i18n/messages';
	import { navigateBack } from '$lib/navigation/back';
	import { resolvedLocale } from '$lib/stores/locale';
	import { ArrowLeft } from '@lucide/svelte';

	let {
		title,
		titleId = undefined as string | undefined,
		backHref = '/',
		backLabel = null as string | null,
		backLabelVisible = false,
		preferHistoryBack = true,
		class: className = '',
		fixed = false,
		/** Nested inside CatalogListStickyChrome: no own sticky/bg/shadow. */
		embedded = false,
		/** Collapsed line clamp for long titles (tap expands). */
		titleLines = 2,
		actions
	}: {
		title: string;
		titleId?: string;
		backHref?: string;
		backLabel?: string | null;
		/** Show destination text next to the back arrow (e.g. «Тренировки»). */
		backLabelVisible?: boolean;
		/** Match iOS swipe-back: history first, then backHref. */
		preferHistoryBack?: boolean;
		class?: string;
		/** Pin to viewport top on mobile sub-routes (long scroll lists). */
		fixed?: boolean;
		embedded?: boolean;
		titleLines?: number;
		actions?: import('svelte').Snippet;
	} = $props();

	let lang = $derived($resolvedLocale);
	let crumbLabel = $derived(backLabel ?? backLabelForHref(backHref, lang));
	let headerEl = $state<HTMLElement | null>(null);
	let spacerPx = $state<number | null>(null);

	$effect(() => {
		if (!fixed || embedded) {
			spacerPx = null;
			return;
		}
		const node = headerEl;
		if (!node || typeof ResizeObserver === 'undefined') return;
		const sync = () => {
			/* Chrome only; gap added in style via CSS var (rem-safe). */
			spacerPx = Math.ceil(node.getBoundingClientRect().height);
		};
		sync();
		const ro = new ResizeObserver(sync);
		ro.observe(node);
		return () => ro.disconnect();
	});
</script>

<header
	bind:this={headerEl}
	class="screen-header {className}"
	class:screen-header--fixed={fixed && !embedded}
	class:screen-header--embedded={embedded}
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
	<ExpandableText
		as="h1"
		id={titleId}
		text={title}
		lines={titleLines}
		class="screen-header-title"
		titleAttr
	/>
</header>
{#if fixed && !embedded}
	<div
		class="screen-header-spacer lg:hidden"
		aria-hidden="true"
		style:height={spacerPx != null
			? `calc(${spacerPx}px + var(--screen-header-content-gap))`
			: undefined}
	></div>
{/if}
