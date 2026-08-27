<script lang="ts">
	import { Badge, type BadgeVariant } from '$lib/components/ui/badge/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLAnchorAttributes } from 'svelte/elements';
	import type { Snippet } from 'svelte';

	type Props = WithElementRef<HTMLAnchorAttributes> & {
		variant?: BadgeVariant;
		children?: Snippet;
	};

	let { variant = 'default', class: className, children, ...rest }: Props = $props();
</script>

<Badge {variant} class={cn('min-h-9 gap-1.5 px-3 py-1.5 text-sm', className)} {...rest}>
	{@render children?.()}
</Badge>
