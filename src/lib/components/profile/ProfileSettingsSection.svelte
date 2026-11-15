<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		label,
		hint,
		class: className = '',
		children
	}: {
		label?: string;
		hint?: string;
		class?: string;
		children?: Snippet;
	} = $props();
</script>

<section class="profile-settings-section">
	{#if label}
		<p class="profile-settings-section__label">{label}</p>
	{/if}
	<div class="profile-settings-group panel profile-settings-section__card {className}">
		{@render children?.()}
	</div>
	{#if hint}
		<p class="profile-settings-section__hint">{hint}</p>
	{/if}
</section>
