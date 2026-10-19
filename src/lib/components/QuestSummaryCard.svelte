<script lang="ts">
	import AppPanel from '$lib/components/AppPanel.svelte';
	import HeroFigure from '$lib/components/HeroFigure.svelte';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { heroLevel, type QuestXpBreakdown } from '$lib/domain/quest';
	import type { QuestHeroProfile } from '$lib/domain/questHeroProfile';
	import { figureZones, sessionPayoff } from '$lib/domain/sessionPayoff';
	import type { ExerciseIndexItem, WorkoutSession } from '$lib/domain/types';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { questLastApply, questState } from '$lib/stores/quest';
	import { loadQuestHeroProfile } from '$lib/stores/questHero';
	import { onMount } from 'svelte';

	let {
		session = null,
		names = new Map()
	}: {
		session?: WorkoutSession | null;
		names?: Map<string, ExerciseIndexItem>;
	} = $props();

	let lang = $derived($resolvedLocale);
	let apply = $derived($questLastApply);
	let quest = $derived($questState);
	let profile = $state<QuestHeroProfile | null>(null);
	let level = $derived(heroLevel(quest.hero.totalXp));
	let show = $derived(apply != null && (apply.xpGained > 0 || apply.counted));
	let payoff = $derived(
		session ? sessionPayoff(session, (id) => names.get(id)?.body_part ?? null) : null
	);
	let zones = $derived(payoff ? figureZones(payoff.bodyParts) : []);
	let bestLine = $derived.by(() => {
		if (!payoff?.best) return null;
		const item = names.get(payoff.best.exerciseId);
		const name = item ? exerciseName(item, lang) : payoff.best.exerciseId;
		return { name, weight: String(payoff.best.weightKg) };
	});

	onMount(() => {
		profile = loadQuestHeroProfile();
	});

	function line(key: 'quest.xpBase' | 'quest.xpWeight' | 'quest.xpStreak', xp: number): string | null {
		if (xp <= 0) return null;
		return translate(lang, key, { xp: String(xp) });
	}

	let breakdown = $derived<QuestXpBreakdown | null>(apply?.breakdown ?? null);
</script>

{#if show && apply}
	<AppPanel class="quest-summary text-left" role="status">
		<div class="quest-summary__row">
			<HeroFigure sex={profile?.sex ?? null} {zones} size={72} />
			<div>
				<p class="quest-summary__title">{translate(lang, 'quest.summaryTitle')}</p>
				<p class="quest-summary__xp">
					{translate(lang, 'quest.xpGained', { xp: String(apply.xpGained) })}
				</p>
				{#if breakdown}
					{#if line('quest.xpBase', breakdown.base)}
						<p class="quest-summary__meta">{line('quest.xpBase', breakdown.base)}</p>
					{/if}
					{#if line('quest.xpWeight', breakdown.weightUp)}
						<p class="quest-summary__meta">{line('quest.xpWeight', breakdown.weightUp)}</p>
					{/if}
					{#if line('quest.xpStreak', breakdown.streakBonus)}
						<p class="quest-summary__meta">{line('quest.xpStreak', breakdown.streakBonus)}</p>
					{/if}
				{/if}
				<p class="quest-summary__meta">
					{translate(lang, 'quest.levelLine', { level: String(level) })}
				</p>
			</div>
		</div>
		{#if payoff}
			<p class="quest-summary__meta">{translate(lang, 'quest.volumeKg', { kg: String(payoff.volumeKg) })}</p>
			<p class="quest-summary__meta">{translate(lang, 'quest.setsCount', { n: String(payoff.sets) })}</p>
			{#if bestLine}
				<p class="quest-summary__meta">
					{translate(lang, 'quest.bestSet', bestLine)}
				</p>
			{/if}
		{/if}
		{#if apply.goalJustMet}
			<p class="quest-summary__badge">{translate(lang, 'quest.goalMet')}</p>
		{/if}
	</AppPanel>
{/if}

<style>
	.quest-summary__row {
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}
	.quest-summary__title {
		margin: 0;
		font-weight: 650;
		font-size: 1rem;
	}
	.quest-summary__xp {
		margin: 0.35rem 0 0;
		font-size: 1.125rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: var(--color-xp);
	}
	.quest-summary__meta {
		margin: 0.25rem 0 0;
		font-size: 0.875rem;
		opacity: 0.85;
	}
	.quest-summary__badge {
		margin: 0.5rem 0 0;
		font-size: 0.875rem;
		font-weight: 600;
	}
</style>
