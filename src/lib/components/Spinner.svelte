<script lang="ts">
	let {
		label = null,
		size = 'md',
		block = true
	}: {
		/** Visible label next to the spinner. Screen readers always get a status. */
		label?: string | null;
		size?: 'sm' | 'md' | 'lg';
		/** Full-width centered block (default) vs inline. */
		block?: boolean;
	} = $props();

	let dim = $derived(size === 'sm' ? '1rem' : size === 'lg' ? '2rem' : '1.35rem');
</script>

<div
	class={block ? 'loader loader-block' : 'loader loader-inline'}
	role="status"
	aria-live="polite"
	aria-busy="true"
>
	<span class="loader-spinner" style={`--loader-size: ${dim}`} aria-hidden="true"></span>
	{#if label}
		<span class="loader-label">{label}</span>
	{:else}
		<span class="sr-only">Loading</span>
	{/if}
</div>
