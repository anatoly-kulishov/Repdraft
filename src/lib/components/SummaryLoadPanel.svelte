<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppPanel from '$lib/components/AppPanel.svelte';
	import { labelBodyPart } from '$lib/domain/labels.ru';
	import {
		finishedSessionsWithinDays,
		laggingBodyParts,
		mergeVolumeMaps,
		sessionVolumeByBodyPart,
		volumeShares,
		type BodyPartShare
	} from '$lib/domain/trainingLoad';
	import type { WorkoutSession } from '$lib/domain/types';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	let {
		session,
		allSessions,
		bodyPartFor,
		onAddLagging
	}: {
		session: WorkoutSession;
		allSessions: WorkoutSession[];
		bodyPartFor: (exerciseId: string) => string | null;
		onAddLagging?: (bodyPart: string) => void;
	} = $props();

	let lang = $derived($resolvedLocale);

	let todayShares = $derived.by(() => {
		const todayMap = sessionVolumeByBodyPart(session, bodyPartFor);
		return volumeShares(todayMap).slice(0, 4);
	});

	let lagRows = $derived.by(() => {
		const todayMap = sessionVolumeByBodyPart(session, bodyPartFor);
		const recent = finishedSessionsWithinDays(
			allSessions.filter((s) => s.finishedAt),
			30
		);
		const windowMap = mergeVolumeMaps(
			recent.map((s) => sessionVolumeByBodyPart(s, bodyPartFor))
		);
		return laggingBodyParts(todayMap, windowMap).map((part) => ({
			part,
			label: labelBodyPart(part, lang)
		}));
	});

	let show = $derived(todayShares.length > 0 || lagRows.length > 0);
</script>

{#if show}
	<AppPanel class="summary-load text-left">
		{#if todayShares.length > 0}
			<p class="summary-load__title">{translate(lang, 'summary.workedToday')}</p>
			{#each todayShares as row (row.bodyPart)}
				{@render shareRow(row)}
			{/each}
		{/if}
		{#if lagRows.length > 0}
			<p class="summary-load__title" class:summary-load__title--gap={todayShares.length > 0}>
				{translate(lang, 'summary.lagging30d')}
			</p>
			{#each lagRows as row (row.part)}
				<div class="summary-load__lag">
					<span class="summary-load__lag-label">{row.label}</span>
					{#if onAddLagging}
						<AppButton variant="ghost" class="summary-load__add" onclick={() => onAddLagging(row.part)}>
							{translate(lang, 'summary.addToPlan')}
						</AppButton>
					{/if}
				</div>
			{/each}
		{/if}
	</AppPanel>
{/if}

{#snippet shareRow(row: BodyPartShare)}
	<div class="summary-load__share">
		<span class="summary-load__share-label">{labelBodyPart(row.bodyPart, lang)}</span>
		<div class="summary-load__bar-track">
			<div
				class="summary-load__bar-fill"
				style:width="{Math.max(4, row.sharePct)}%"
			></div>
		</div>
		<span class="summary-load__share-pct tabular-nums">{row.sharePct}%</span>
	</div>
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
	.summary-load__title--gap {
		margin-top: 1rem;
	}
	.summary-load__share {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.35rem;
	}
	.summary-load__share-label {
		width: 5.5rem;
		font-size: 0.875rem;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.summary-load__bar-track {
		flex: 1;
		height: 0.5rem;
		border-radius: var(--radius-sm, 6px);
		background: var(--color-border);
		overflow: hidden;
	}
	.summary-load__bar-fill {
		height: 100%;
		background: var(--color-accent);
	}
	.summary-load__share-pct {
		width: 2.25rem;
		text-align: right;
		font-size: 0.8125rem;
		font-weight: 600;
		opacity: 0.75;
	}
	.summary-load__lag {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.35rem;
	}
	.summary-load__lag-label {
		font-size: 0.9375rem;
		font-weight: 600;
	}
	.summary-load__add {
		min-height: 3rem;
		min-width: 3rem;
	}
</style>
