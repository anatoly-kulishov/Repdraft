<script lang="ts">
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

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

	let lang = $derived($resolvedLocale);
	let dim = $derived(size === 'sm' ? '1rem' : size === 'lg' ? '2rem' : '1.35rem');
	let statusLabel = $derived(label ?? translate(lang, 'common.loading'));
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
		<span class="sr-only">{statusLabel}</span>
	{/if}
</div>
