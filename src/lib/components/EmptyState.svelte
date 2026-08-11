<script lang="ts">
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import type { Component } from 'svelte';

	type EmptyStateIcon = Component<{
		size?: number | string;
		strokeWidth?: number | string;
		fill?: string;
		class?: string;
	}>;

	let {
		title,
		description,
		actionHref,
		actionLabel,
		icon = null as EmptyStateIcon | null,
		centered = false,
		class: className = ''
	}: {
		title: string;
		description?: string;
		actionHref?: string;
		actionLabel?: string;
		icon?: EmptyStateIcon | null;
		centered?: boolean;
		class?: string;
	} = $props();
</script>

<div
	class="panel-dashed empty-state flex flex-col gap-3 py-6 {centered
		? 'empty-state--centered items-center text-center'
		: 'items-start text-left'} {className}"
>
	{#if icon}
		<div class="empty-state__icon" aria-hidden="true">
			<LucideIcon {icon} size={28} />
		</div>
	{/if}
	<h2 class="section-title empty-state__title">{title}</h2>
	{#if description}
		<p class="empty-state__desc max-w-md text-sm leading-relaxed text-[var(--color-muted)]">
			{description}
		</p>
	{/if}
	{#if actionHref && actionLabel}
		<a class="btn-primary empty-state__action mt-1" href={actionHref}>{actionLabel}</a>
	{/if}
</div>
