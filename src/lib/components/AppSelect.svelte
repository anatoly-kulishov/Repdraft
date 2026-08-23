<script lang="ts">
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLSelectAttributes } from 'svelte/elements';

	type Props = WithElementRef<HTMLSelectAttributes>;

	let { class: className, ref = $bindable(null), children, ...rest }: Props = $props();
</script>

<select
	bind:this={ref}
	class={cn(
		'h-12 min-h-12 w-full min-w-0 rounded-md border border-input bg-transparent px-2.5 py-1 text-base shadow-xs transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 outline-none',
		className
	)}
	{...rest}
>
	{@render children?.()}
</select>
