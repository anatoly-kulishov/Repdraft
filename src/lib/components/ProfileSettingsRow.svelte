<script lang="ts">
	import IconPlate from '$lib/components/IconPlate.svelte';
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
		children?: import('svelte').Snippet;
	};

let { icon, label, hint, iconTone = 'default', value, ariaLabel, href, onclick, children }: Props =
		$props();
</script>

{#snippet body()}
	<IconPlate {icon} tone={iconTone} class="profile-settings-row__icon" />
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
	<a class="profile-settings-row profile-settings-row--cycle" aria-label={ariaLabel ?? label} {href}>
		{@render body()}
	</a>
{:else if onclick}
	<button
		type="button"
		class="profile-settings-row profile-settings-row--cycle"
		aria-label={ariaLabel ?? label}
		{onclick}
	>
		{@render body()}
	</button>
{:else}
	<div class="profile-settings-row">
		{@render body()}
	</div>
{/if}
