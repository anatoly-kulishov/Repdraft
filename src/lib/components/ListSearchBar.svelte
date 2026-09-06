<script lang="ts">
	import SearchInput from '$lib/components/SearchInput.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_BUTTON } from '$lib/components/icons/sizes';
	import { cn } from '$lib/utils.js';
	import { SlidersHorizontal } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	let {
		value = $bindable(''),
		placeholder = '',
		debounceMs = 180,
		/** Stick under ScreenHeader (History). Parent still sets sticky top via BEM modifier. */
		sticky = false,
		matchLabel = '',
		filterActive = false,
		filterAriaLabel = '',
		filterExpanded = false,
		onFilterClick,
		class: className = '',
		children
	}: {
		value?: string;
		placeholder?: string;
		debounceMs?: number;
		sticky?: boolean;
		/** Quiet meta under the bar, e.g. "12 matches". */
		matchLabel?: string;
		filterActive?: boolean;
		filterAriaLabel?: string;
		filterExpanded?: boolean;
		onFilterClick?: () => void;
		class?: string;
		children?: Snippet;
	} = $props();

	let showFilter = $derived(typeof onFilterClick === 'function');
</script>

<div class={cn('list-search-bar', sticky && 'list-search-bar--sticky', className)}>
	<div class="list-search-bar__row">
		<div class="list-search-bar__search">
			<SearchInput bind:value {placeholder} {debounceMs} />
		</div>
		{#if showFilter}
			<button
				type="button"
				class={cn('list-search-bar__filter', filterActive && 'is-active')}
				aria-label={filterAriaLabel}
				title={filterAriaLabel}
				aria-haspopup="dialog"
				aria-expanded={filterExpanded}
				onclick={() => onFilterClick?.()}
			>
				<LucideIcon icon={SlidersHorizontal} size={ICON_BUTTON} />
				{#if filterActive}
					<span class="list-search-bar__filter-badge" aria-hidden="true"></span>
				{/if}
			</button>
		{/if}
	</div>
	{#if matchLabel}
		<p class="list-search-bar__count" aria-live="polite">{matchLabel}</p>
	{/if}
	{#if children}
		<div class="list-search-bar__extra">
			{@render children()}
		</div>
	{/if}
</div>
