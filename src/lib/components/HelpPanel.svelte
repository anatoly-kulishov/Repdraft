<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		open = false,
		title,
		body = undefined as string | undefined,
		children
	}: {
		open?: boolean;
		/** Short heading, e.g. «Как считается объём». */
		title: string;
		/** One-paragraph explanation. */
		body?: string;
		/** Extra content (lists, links) rendered under the body. */
		children?: Snippet;
	} = $props();
</script>

{#if open}
	<div class="panel help-panel" role="region" aria-label={title}>
		<p class="help-panel__title">{title}</p>
		{#if body}
			<p class="help-panel__body">{body}</p>
		{/if}
		{#if children}
			{@render children()}
		{/if}
	</div>
{/if}
