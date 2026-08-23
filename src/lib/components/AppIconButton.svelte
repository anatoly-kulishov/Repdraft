<script lang="ts">
	import { Button, type ButtonProps } from '$lib/components/ui/button/index.js';
	import { cn } from '$lib/utils.js';

	type Props = Omit<ButtonProps, 'variant' | 'size'>;

	let { class: className, children, ...rest }: Props = $props();
</script>

<Button variant="ghost" size="icon" class={cn('btn-icon-close min-h-12 min-w-12 size-12', className)} {...rest}>
	{@render children?.()}
</Button>
