<script lang="ts">
	import { cn } from '$lib/utils.js';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	type Props = HTMLButtonAttributes & {
		selected?: boolean;
		label: string;
	};

	let { selected = false, label, class: className, ...rest }: Props = $props();
</script>

<button
	type="button"
	role="tab"
	aria-selected={selected}
	class={cn(
		'inline-flex items-center justify-center',
		'min-h-12 px-3 rounded-full border text-sm font-semibold',
		selected
			? 'border-accent bg-accent text-white'
			: 'border-border bg-transparent text-muted hover:bg-surface hover:border-border',
		className
	)}
	{...rest}
>
	{label}
</button>
