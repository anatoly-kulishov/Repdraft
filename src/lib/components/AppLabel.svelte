<script lang="ts">
	import { Label } from '$lib/components/ui/label/index.js';
	import { cn } from '$lib/utils.js';
	import type { Label as LabelPrimitive } from 'bits-ui';
	import type { Snippet } from 'svelte';

	type Props = LabelPrimitive.RootProps & {
		children?: Snippet;
	};

	let { class: className, children, ...rest }: Props = $props();
</script>

<Label class={cn('field-label', className)} {...rest}>
	{@render children?.()}
</Label>
