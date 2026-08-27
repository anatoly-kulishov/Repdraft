<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		inset?: boolean;
		dashed?: boolean;
		children?: Snippet;
	};

	let {
		ref = $bindable(null),
		inset = false,
		dashed = false,
		class: className,
		children,
		...rest
	}: Props = $props();
</script>

<Card.Root
	bind:ref
	class={cn(
		'panel gap-0 border-border/80 bg-card p-4 shadow-sm ring-0',
		inset && 'bg-muted/30',
		dashed && 'panel-dashed border-dashed bg-transparent shadow-none',
		className
	)}
	{...rest}
>
	{@render children?.()}
</Card.Root>
