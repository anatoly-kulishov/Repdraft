<script lang="ts">
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_PRIMARY, ICON_SMALL } from '$lib/components/icons/sizes';
	import Spinner from '$lib/components/Spinner.svelte';
	import type { IconComponentProps, IconWeight } from 'phosphor-svelte';
	import { CaretRight as ChevronRight } from 'phosphor-svelte';
	import type { Component } from 'svelte';

	type Props = {
		icon?: Component<IconComponentProps>;
		label: string;
		hint?: string;
		iconTone?: 'default' | 'accent' | 'muted';
		iconWeight?: IconWeight;
		value?: string;
		ariaLabel?: string;
		href?: string;
		onclick?: () => void;
		/** Show trailing chevron on navigable / cycle rows. */
		chevron?: boolean;
		/** Small accent dot before the chevron (e.g. new coach hints). */
		badge?: boolean;
		/** Destructive action: red label. */
		danger?: boolean;
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
		iconWeight = 'regular',
		value,
		ariaLabel,
		href,
		onclick,
		chevron,
		badge = false,
		danger = false,
		busy = false,
		disabled = false,
		children
	}: Props = $props();

	let locked = $derived(disabled || busy);
	let showChevron = $derived(
		chevron ?? Boolean((href || onclick) && !children && !busy)
	);
	let hasTrailing = $derived(Boolean(value || children || badge || showChevron));
</script>

{#snippet body()}
	{#if busy}
		<span class="profile-settings-row__icon profile-settings-row__busy" aria-hidden="true">
			<Spinner size="sm" block={false} />
		</span>
	{:else if icon}
		<span
			class="profile-settings-row__icon"
			class:profile-settings-row__icon--accent={iconTone === 'accent'}
			class:profile-settings-row__icon--muted={iconTone === 'muted'}
			class:profile-settings-row__icon--danger={danger}
			aria-hidden="true"
		>
			<LucideIcon {icon} size={ICON_PRIMARY} weight={iconWeight} />
		</span>
	{/if}
	<span class="profile-settings-row__label">
		{label}
		{#if hint}<span class="profile-settings-row__hint">{hint}</span>{/if}
	</span>
	{#if hasTrailing}
		<span class="profile-settings-row__trailing">
			{#if value}
				<span class="profile-settings-row__value">{value}</span>
			{/if}
			{#if children}
				<span class="profile-settings-row__control">
					{@render children()}
				</span>
			{/if}
			{#if badge}
				<span class="profile-settings-row__badge" aria-hidden="true"></span>
			{/if}
			{#if showChevron}
				<span class="profile-settings-row__chevron" aria-hidden="true">
					<LucideIcon icon={ChevronRight} size={ICON_SMALL} />
				</span>
			{/if}
		</span>
	{/if}
{/snippet}

{#if href}
	<a
		class="profile-settings-row profile-settings-row--cycle"
		class:profile-settings-row--busy={busy}
		class:profile-settings-row--danger={danger}
		class:profile-settings-row--no-icon={!icon && !busy}
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
		class:profile-settings-row--danger={danger}
		class:profile-settings-row--no-icon={!icon && !busy}
		aria-label={ariaLabel ?? label}
		aria-busy={busy || undefined}
		disabled={locked}
		{onclick}
	>
		{@render body()}
	</button>
{:else}
	<div
		class="profile-settings-row"
		class:profile-settings-row--busy={busy}
		class:profile-settings-row--danger={danger}
		class:profile-settings-row--no-icon={!icon && !busy}
		aria-busy={busy || undefined}
	>
		{@render body()}
	</div>
{/if}
