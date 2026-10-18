<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import { cn } from '$lib/utils.js';
	import type { ComponentProps, Snippet } from 'svelte';

	type Props = ComponentProps<typeof AppButton> & {
		active?: boolean;
		children?: Snippet;
	};

	let { active = false, class: className, children, ...rest }: Props = $props();
</script>

<AppButton
	variant="secondary"
	type="button"
	class={cn(
		'h-auto min-h-12 min-w-[48px] w-auto rounded-full px-3 py-1.5 font-medium',
		active && 'is-active',
		className
	)}
	aria-pressed={active}
	{...rest}
>
	{@render children?.()}
</AppButton>
