<script lang="ts">
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import { cn } from '$lib/utils.js';
	import type { Component } from 'svelte';

	type IconPlateTone = 'default' | 'accent' | 'muted';

	type Props = {
		icon: Component<{ size?: number | string; strokeWidth?: number | string }>;
		tone?: IconPlateTone;
		size?: number;
		class?: string;
	};

	let { icon, tone = 'default', size = ICON_SMALL, class: className }: Props = $props();
</script>

<span class={cn('icon-plate', tone !== 'default' && `icon-plate--${tone}`, className)}>
	<LucideIcon {icon} {size} strokeWidth={1.85} />
</span>
