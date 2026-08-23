<script lang="ts">
	import AppCheckbox from '$lib/components/AppCheckbox.svelte';
	import { cn, type WithoutChildrenOrChild } from '$lib/utils.js';
	import type { ComponentProps } from 'svelte';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';

	type Props = WithoutChildrenOrChild<ComponentProps<typeof Checkbox>>;

	let {
		class: className,
		checked = $bindable(false),
		indeterminate = $bindable(false),
		...rest
	}: Props = $props();
</script>

<Checkbox
	bind:checked
	bind:indeterminate
	class={cn('size-5 min-h-5 min-w-5', className)}
	{...rest}
/>
