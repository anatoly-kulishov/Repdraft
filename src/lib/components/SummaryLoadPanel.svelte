<script lang="ts">
	import { Plus } from 'phosphor-svelte';
	import AppPanel from '$lib/components/AppPanel.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { labelCatalogZone } from '$lib/domain/catalogLinks';
	import {
		WEEKLY_SETS_AIM,
		sessionSetsByBodyPart,
		setShares,
		weeklySetsByZone,
		type ZoneWeekSets
	} from '$lib/domain/trainingLoad';
	import type { WorkoutSession } from '$lib/domain/types';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	let {
		session,
		allSessions,
		bodyPartFor,
		onAddToPlan
	}: {
		session: WorkoutSession;
		allSessions: WorkoutSession[];
		bodyPartFor: (exerciseId: string) => string | null;
		onAddToPlan?: (bodyPart: string) => void;
	} = $props();

	let lang = $derived($resolvedLocale);

	// Today: hard sets per zone, bars scaled to the biggest zone of the session.
	let todayRows = $derived.by(() =>
		setShares(sessionSetsByBodyPart(session, bodyPartFor)).slice(0, 4)
	);
	let todayMax = $derived(Math.max(1, ...todayRows.map((row) => row.sets)));

	// Week: sets against an absolute aim per group. The session may not be in the
	// refreshed history yet, so make sure it counts.
	let weekRows = $derived.by(() => {
		const sessions = allSessions.some((entry) => entry.id === session.id)
			? allSessions
			: [session, ...allSessions];
		return weeklySetsByZone(sessions, bodyPartFor);
	});
	let weekList = $derived(weekRows.slice(0, 6));

	let show = $derived(todayRows.length > 0 || weekRows.length > 0);
</script>

{#if show}
	<AppPanel class="summary-load text-left">
		{#if todayRows.length > 0}
			<p class="summary-load__title">{translate(lang, 'summary.setsToday')}</p>
			{#each todayRows as row (row.bodyPart)}
				<div class="summary-load__row">
					<span class="summary-load__label">{labelCatalogZone(row.bodyPart, lang)}</span>
					<div class="summary-load__track">
						<div
							class="summary-load__fill"
							style:width="{Math.max(6, Math.round((row.sets / todayMax) * 100))}%"
						></div>
					</div>
					<span class="summary-load__value tabular-nums">{row.sets}</span>
				</div>
			{/each}
		{/if}

		{#if weekRows.length > 0}
			<div class="summary-load__head" class:summary-load__head--gap={todayRows.length > 0}>
				<p class="summary-load__title summary-load__title--flush">
					{translate(lang, 'summary.weekSets')}
				</p>
				<span class="summary-load__hint">
					{translate(lang, 'summary.weekSetsAim', { aim: WEEKLY_SETS_AIM })}
				</span>
			</div>
			{#each weekList as row (row.bodyPart)}
				{@const add = row.sets < WEEKLY_SETS_AIM && onAddToPlan}
				{#if add}
					<button
						type="button"
						class="summary-load__row summary-load__row--action"
						aria-label={translate(lang, 'summary.addToPlanAria', {
							part: labelCatalogZone(row.bodyPart, lang)
						})}
						onclick={() => onAddToPlan?.(row.bodyPart)}
					>
						{@render weekRow(row)}
						<LucideIcon icon={Plus} size={16} class="summary-load__plus" />
					</button>
				{:else}
					<div class="summary-load__row">
						{@render weekRow(row)}
					</div>
				{/if}
			{/each}
		{/if}
	</AppPanel>
{/if}

{#snippet weekRow(row: ZoneWeekSets)}
	<span class="summary-load__label">{labelCatalogZone(row.bodyPart, lang)}</span>
	<div class="summary-load__track">
		<div
			class="summary-load__fill"
			style:width="{Math.min(100, Math.max(4, Math.round((row.sets / WEEKLY_SETS_AIM) * 100)))}%"
		></div>
	</div>
	<span class="summary-load__value tabular-nums">{row.sets} / {WEEKLY_SETS_AIM}</span>
{/snippet}

<style>
	.summary-load__title {
		margin: 0 0 0.65rem;
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		opacity: 0.75;
	}
	.summary-load__title--flush {
		margin-bottom: 0;
	}
	.summary-load__head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.65rem;
	}
	.summary-load__head--gap {
		margin-top: 1rem;
	}
	.summary-load__hint {
		font-size: 0.75rem;
		font-weight: 600;
		opacity: 0.6;
		text-align: right;
	}
	.summary-load__row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		margin-bottom: 0.35rem;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
	}
	.summary-load__row--action {
		min-height: 2.75rem;
		margin-bottom: 0.15rem;
		padding: 0 0.35rem;
		margin-left: -0.35rem;
		width: calc(100% + 0.7rem);
		border-radius: var(--radius-md, 10px);
		cursor: pointer;
	}
	.summary-load__row--action:hover {
		background: var(--color-surface-muted);
	}
	.summary-load__row--action:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}
	.summary-load__row--action :global(.summary-load__plus) {
		color: var(--color-accent);
	}
	.summary-load__label {
		width: 5rem;
		font-size: 0.875rem;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.summary-load__track {
		flex: 1;
		height: 0.5rem;
		border-radius: var(--radius-sm, 6px);
		background: var(--color-border);
		overflow: hidden;
	}
	.summary-load__fill {
		height: 100%;
		background: var(--color-accent);
	}
	.summary-load__value {
		min-width: 3.25rem;
		text-align: right;
		font-size: 0.8125rem;
		font-weight: 600;
		opacity: 0.75;
	}
</style>
