<script lang="ts">
	import IconPlate from '$lib/components/IconPlate.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import type { Component } from 'svelte';

	type Props = {
		icon: Component<{ size?: number | string; strokeWidth?: number | string }>;
		label: string;
		hint?: string;
		iconTone?: 'default' | 'accent' | 'muted';
		value?: string;
		ariaLabel?: string;
		href?: string;
		onclick?: () => void;
		/** Show inline spinner in the icon slot; keeps the label readable. */
		busy?: boolean;
		disabled?: boolean;
		children?: import('svelte').Snippet;
	};

	let {
		icon,
		label,
		hint,
		iconTone = 'default',
		value,
		ariaLabel,
		href,
		onclick,
		busy = false,
		disabled = false,
		children
	}: Props = $props();

	let locked = $derived(disabled || busy);
</script>

{#snippet body()}
	{#if busy}
		<span class="profile-settings-row__icon profile-settings-row__busy" aria-hidden="true">
			<Spinner size="sm" block={false} />
		</span>
	{:else}
		<IconPlate {icon} tone={iconTone} class="profile-settings-row__icon" />
	{/if}
	<span class="profile-settings-row__label">{label}</span>
	{#if value}
		<span class="profile-settings-row__value">{value}</span>
	{:else if children}
		<div class="profile-settings-row__control">
			{@render children()}
		</div>
	{/if}
	{#if hint}
		<span class="profile-settings-row__hint">{hint}</span>
	{/if}
{/snippet}

{#if href}
	<a
		class="profile-settings-row profile-settings-row--cycle"
		class:profile-settings-row--busy={busy}
		aria-label={ariaLabel ?? label}
		aria-busy={busy || undefined}
		aria-disabled={locked || undefined}
		tabindex={locked ? -1 : undefined}
		{href}
		onclick={(e) => {
			if (locked) e.preventDefault();
		}}
	>
		{@render body()}
	</a>
{:else if onclick}
	<button
		type="button"
		class="profile-settings-row profile-settings-row--cycle"
		class:profile-settings-row--busy={busy}
		aria-label={ariaLabel ?? label}
		aria-busy={busy || undefined}
		disabled={locked}
		{onclick}
	>
		{@render body()}
	</button>
{:else}
	<div class="profile-settings-row" class:profile-settings-row--busy={busy} aria-busy={busy || undefined}>
		{@render body()}
	</div>
{/if}
