<script lang="ts">
	import {
		ACHIEVEMENT_IDS,
		achievementCategory,
		achievementHintKey,
		achievementProgressList,
		achievementTitleKey,
		isUnlocked,
		type AchievementCategory,
		type AchievementId,
		type AchievementsState
	} from '$lib/domain/achievements';
	import Chip from '$lib/components/Chip.svelte';
	import type { WorkoutSession } from '$lib/domain/types';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	let {
		state: achState,
		finishedSessions = [],
		highlightIds = null,
		showFilters = false
	}: {
		state: AchievementsState;
		finishedSessions?: WorkoutSession[];
		highlightIds?: AchievementId[] | null;
		showFilters?: boolean;
	} = $props();

	const FILTERS: AchievementCategory[] = ['all', 'routine', 'quest', 'records'];

	let lang = $derived($resolvedLocale);
	let filter = $state<AchievementCategory>('all');
	let highlight = $derived(new Set(highlightIds ?? []));
	let progress = $derived(achievementProgressList(achState, finishedSessions));
	let progressById = $derived(new Map(progress.map((p) => [p.id, p])));
	let ids = $derived(
		ACHIEVEMENT_IDS.filter((id) => filter === 'all' || achievementCategory(id) === filter)
	);
	let unlockedCount = $derived(ACHIEVEMENT_IDS.filter((id) => isUnlocked(achState, id)).length);
</script>

{#if showFilters}
	<div class="ach-panel__chips" role="tablist">
		{#each FILTERS as f (f)}
			<Chip
				label={translate(lang, `achievements.filter.${f}`)}
				selected={filter === f}
				onclick={() => (filter = f)}
			/>
		{/each}
	</div>
	<p class="ach-panel__count">
		{translate(lang, 'achievements.progressCount', {
			n: String(unlockedCount),
			total: String(ACHIEVEMENT_IDS.length)
		})}
	</p>
{/if}

<ul class="ach-panel__list">
	{#each ids as id (id)}
		{@const unlocked = isUnlocked(achState, id)}
		{@const isNew = highlight.has(id)}
		{@const prog = progressById.get(id)}
		{@const showBar =
			prog && prog.target > 1 && !unlocked && achievementCategory(id) === 'routine'}
		<li
			class="ach-panel__row"
			class:ach-panel__row--on={unlocked}
			class:ach-panel__row--new={isNew}
		>
			<span class="ach-panel__mark" class:ach-panel__mark--on={unlocked} aria-hidden="true">
				{unlocked ? '✓' : '○'}
			</span>
			<div class="ach-panel__copy">
				<p class="ach-panel__title" class:ach-panel__title--off={!unlocked}>
					{translate(lang, achievementTitleKey(id))}
					{#if isNew}
						<span class="ach-panel__new"> · {translate(lang, 'achievements.new')}</span>
					{/if}
				</p>
				<p class="ach-panel__hint">{translate(lang, achievementHintKey(id))}</p>
				{#if showBar && prog}
					<div class="ach-panel__bar-track">
						<div
							class="ach-panel__bar-fill"
							style:width="{Math.round((prog.current / prog.target) * 100)}%"
						></div>
					</div>
					<p class="ach-panel__prog tabular-nums">{prog.current}/{prog.target}</p>
				{/if}
			</div>
		</li>
	{/each}
</ul>

<style>
	.ach-panel__chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin-bottom: 0.65rem;
	}
	.ach-panel__count {
		margin: 0 0 0.75rem;
		font-size: 0.8125rem;
		opacity: 0.75;
	}
	.ach-panel__list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.ach-panel__row {
		display: flex;
		gap: 0.65rem;
		padding: 0.65rem 0.75rem;
		border-radius: var(--radius-md, 10px);
		border: 1px solid var(--color-border);
		opacity: 0.85;
	}
	.ach-panel__row--on {
		opacity: 1;
		border-color: color-mix(in srgb, var(--color-accent) 35%, var(--color-border));
	}
	.ach-panel__row--new {
		border-color: var(--color-accent);
	}
	.ach-panel__mark {
		font-weight: 700;
		opacity: 0.45;
	}
	.ach-panel__mark--on {
		color: var(--color-accent);
		opacity: 1;
	}
	.ach-panel__title {
		margin: 0;
		font-weight: 700;
		font-size: 0.9375rem;
	}
	.ach-panel__title--off {
		opacity: 0.75;
	}
	.ach-panel__new {
		font-weight: 600;
		color: var(--color-accent);
	}
	.ach-panel__hint {
		margin: 0.2rem 0 0;
		font-size: 0.8125rem;
		opacity: 0.75;
		line-height: 1.35;
	}
	.ach-panel__bar-track {
		margin-top: 0.45rem;
		height: 0.375rem;
		border-radius: 999px;
		background: var(--color-border);
		overflow: hidden;
	}
	.ach-panel__bar-fill {
		height: 100%;
		background: var(--color-accent);
	}
	.ach-panel__prog {
		margin: 0.25rem 0 0;
		font-size: 0.75rem;
		opacity: 0.7;
	}
</style>
