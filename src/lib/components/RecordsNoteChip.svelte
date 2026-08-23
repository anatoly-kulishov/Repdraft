<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { cn } from '$lib/utils.js';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import type { AppLocale } from '$lib/i18n/locale';
	import { translate } from '$lib/i18n/messages';
	import { ChevronDown } from '@lucide/svelte';
	import { onMount } from 'svelte';

	let {
		text,
		lang,
		open = false,
		onToggle,
		measureRootSelector = '.records-list-content'
	}: {
		text: string;
		lang: AppLocale;
		open?: boolean;
		onToggle?: () => void;
		measureRootSelector?: string;
	} = $props();

	let measureTextEl = $state<HTMLSpanElement | null>(null);
	let canExpand = $state(false);

	function updateOverflow() {
		const el = measureTextEl;
		if (!el) return;
		canExpand = el.scrollWidth > el.clientWidth + 1;
	}

	$effect(() => {
		text;
		queueMicrotask(updateOverflow);
	});

	onMount(() => {
		const root = measureTextEl?.closest(measureRootSelector);
		if (!root) return;
		const ro = new ResizeObserver(() => updateOverflow());
		ro.observe(root);
		return () => ro.disconnect();
	});
</script>

<!-- Off-screen width probe — must not reuse .records-note-chip (background/::after breaks lift badge). -->
<span class="records-note-overflow-measure" aria-hidden="true" bind:this={measureTextEl}>{text}</span>

{#if canExpand}
	<AppButton
		variant="ghost"
		class={cn('records-note-chip !h-auto !min-h-0 !min-w-0 w-auto p-0', open && 'is-open')}
		aria-expanded={open}
		aria-label={translate(lang, open ? 'pr.nowCollapse' : 'pr.nowExpand')}
		title={translate(lang, open ? 'pr.nowCollapse' : 'pr.nowExpand')}
		onclick={() => onToggle?.()}
	>
		<span class="records-note-chip__text">{text}</span>
		<span class="records-note-chip__chevron" aria-hidden="true">
			<LucideIcon icon={ChevronDown} size={ICON_SMALL} />
		</span>
	</AppButton>
{:else}
	<p class="records-note-chip records-note-chip--static">{text}</p>
{/if}
