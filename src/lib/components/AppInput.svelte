<script lang="ts">
	import { Input } from '$lib/components/ui/input/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLInputAttributes, HTMLInputTypeAttribute } from 'svelte/elements';

	type InputType = Exclude<HTMLInputTypeAttribute, 'file'>;

	type Props = WithElementRef<
		Omit<HTMLInputAttributes, 'type'> &
			({ type: 'file'; files?: FileList } | { type?: InputType; files?: undefined })
	>;

	let {
		class: className,
		ref = $bindable(null),
		value = $bindable(),
		type,
		files = $bindable(),
		...rest
	}: Props = $props();
</script>

{#if type === 'file'}
	<Input
		bind:ref
		bind:files
		bind:value
		type="file"
		class={cn('h-12 min-h-12 px-3.5 py-3 text-base leading-normal', className)}
		{...rest}
	/>
{:else}
	<Input
		bind:ref
		bind:value
		{type}
		class={cn('h-12 min-h-12 px-3.5 py-3 text-base leading-normal', className)}
		{...rest}
	/>
{/if}
