<script lang="ts">
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

<LucideIcon {icon} {size} {strokeWidth} />
