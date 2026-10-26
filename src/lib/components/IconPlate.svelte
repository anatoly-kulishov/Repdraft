<script lang="ts">
	import { ICON_PRIMARY } from '$lib/components/icons/sizes';
	import { cn } from '$lib/utils.js';
	import type { IconComponentProps, IconWeight } from 'phosphor-svelte';
	import type { Component } from 'svelte';

	type IconPlateTone = 'default' | 'accent' | 'muted';

	type Props = {
		icon: Component<IconComponentProps>;
		tone?: IconPlateTone;
		weight?: IconWeight;
		size?: number;
		class?: string;
	};

	let {
		icon: Icon,
		tone = 'default',
		weight = 'regular',
		size = ICON_PRIMARY,
		class: className
	}: Props = $props();
</script>

<span
	class={cn('icon-plate', tone !== 'default' && `icon-plate--${tone}`, className)}
	aria-hidden="true"
>
	<Icon {size} {weight} />
</span>
