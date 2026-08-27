<script lang="ts">
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLTextareaAttributes } from 'svelte/elements';

	type Props = WithElementRef<HTMLTextareaAttributes>;

	let { class: className, ref = $bindable(null), value = $bindable(), ...rest }: Props = $props();
</script>

<Textarea bind:ref bind:value class={cn('min-h-12 text-base', className)} {...rest} />
