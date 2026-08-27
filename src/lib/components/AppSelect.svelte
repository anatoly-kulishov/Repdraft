<script lang="ts">
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLSelectAttributes } from 'svelte/elements';

	type Props = WithElementRef<HTMLSelectAttributes>;

	let { class: className, ref = $bindable(null), children, ...rest }: Props = $props();
</script>

<select
	bind:this={ref}
	class={cn('field', className)}
	{...rest}
>
	{@render children?.()}
</select>
