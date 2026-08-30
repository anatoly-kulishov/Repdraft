<script lang="ts">
	import { browser } from '$app/environment';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { themeToggleActionIcon } from '$lib/components/icons/themeToggle';
	import { ICON_SIDEBAR, ICON_STROKE } from '$lib/components/icons/sizes';

	let {
		isLight,
		size = ICON_SIDEBAR,
		strokeWidth = ICON_STROKE
	}: {
		isLight: boolean;
		size?: number;
		strokeWidth?: number;
	} = $props();

	let icon = $derived(themeToggleActionIcon(isLight));
</script>

{#if browser}
	{#key isLight}
		<LucideIcon {icon} {size} {strokeWidth} />
	{/key}
{:else}
	<span class="theme-toggle-icon__placeholder" aria-hidden="true"></span>
{/if}

<style>
	.theme-toggle-icon__placeholder {
		display: block;
		width: 1.25rem;
		height: 1.25rem;
	}
</style>
