<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_PRIMARY } from '$lib/components/icons/sizes';
	import { cn } from '$lib/utils.js';
	import { Plus } from '@lucide/svelte';
	import type { Component } from 'svelte';

	let {
		href,
		label,
		icon = Plus,
		placement = 'tabbar',
		hidden = false,
		class: className = ''
	}: {
		href: string;
		label: string;
		icon?: Component<{ size?: number | string; strokeWidth?: number | string; class?: string }>;
		placement?: 'tabbar' | 'sticky';
		hidden?: boolean;
		class?: string;
	} = $props();
</script>

<AppButton
	{href}
	class={cn(`app-fab app-fab--${placement}`, hidden && 'app-fab--hidden', className)}
	aria-label={label}
	title={label}
>
	<LucideIcon {icon} size={ICON_PRIMARY} />
</AppButton>
