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
		'min-h-12 min-w-12 px-3 rounded-full border text-sm font-semibold',
		selected
			? 'border-[var(--color-accent-fill)] bg-[var(--color-accent-fill)] text-[var(--color-accent-ink)]'
			: // Use product tokens: Tailwind `text-muted` maps to shadcn plate `--muted`, not ink.
				'border-[var(--color-border)] bg-transparent text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:border-[var(--color-border)]',
		className
	)}
	{...rest}
>
	{label}
</button>
