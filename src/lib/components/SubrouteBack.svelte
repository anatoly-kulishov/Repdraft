<script lang="ts">
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_PRIMARY, ICON_SMALL } from '$lib/components/icons/sizes';
	import { navigateBack } from '$lib/navigation/back';
	import { ArrowLeft } from '@lucide/svelte';

	let {
		href,
		label,
		class: className = '',
		preferHistoryBack = true,
		/** icon = compact crumb; link = arrow + label (profile hero, desktop crumbs). */
		variant = 'icon' as 'icon' | 'link'
	}: {
		href: string;
		label: string;
		class?: string;
		preferHistoryBack?: boolean;
		variant?: 'icon' | 'link';
	} = $props();

	const iconSize = $derived(variant === 'link' ? ICON_PRIMARY : ICON_SMALL);
</script>

{#if preferHistoryBack}
	<button
		type="button"
		class="subroute-back subroute-back--{variant} {className}"
		aria-label={label}
		onclick={() => navigateBack(href)}
	>
		<LucideIcon icon={ArrowLeft} size={iconSize} />
		<span class="subroute-back__label">{label}</span>
	</button>
{:else}
	<a class="subroute-back subroute-back--{variant} {className}" {href}>
		<LucideIcon icon={ArrowLeft} size={iconSize} />
		<span class="subroute-back__label">{label}</span>
	</a>
{/if}
