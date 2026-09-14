<script lang="ts">
	import { watchWindowScrolled } from '$lib/dom/watchWindowScrolled';
	import type { Snippet } from 'svelte';

	let {
		header,
		tools
	}: {
		/** Typically ScreenHeader with embedded. */
		header: Snippet;
		/** Search / FilterBar / skeleton. Omit for header-only empty chrome. */
		tools?: Snippet;
	} = $props();

	let scrolled = $state(false);

	$effect(() => {
		return watchWindowScrolled((next) => {
			scrolled = next;
		});
	});
</script>

<div
	class="catalog-list-layout__filters catalog-list-layout__filters--monolith"
	class:is-scrolled={scrolled}
>
	{@render header()}
	{#if tools}
		{@render tools()}
	{/if}
</div>
