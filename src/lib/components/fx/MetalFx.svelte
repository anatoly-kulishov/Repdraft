<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils.js';

	type Props = {
		class?: string;
		children?: Snippet;
	};

	let { class: className = '', children }: Props = $props();
</script>

<div class={cn('fx-metal', className)}>
	<span class="fx-metal__ring" aria-hidden="true"></span>
	<div class="fx-metal__content">
		{@render children?.()}
	</div>
</div>
