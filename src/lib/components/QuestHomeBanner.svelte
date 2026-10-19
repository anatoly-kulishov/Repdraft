<script lang="ts">
	import AppPanel from '$lib/components/AppPanel.svelte';
	import HeroFigure from '$lib/components/HeroFigure.svelte';
	import { heroDisplayStats } from '$lib/domain/heroStats';
	import {
		STARTER_CAMPAIGN_CHAPTERS,
		heroXpProgress,
		questDailyHint,
		type QuestState
	} from '$lib/domain/quest';
	import type { QuestHeroProfile } from '$lib/domain/questHeroProfile';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { live } from '$lib/stores/live';
	import { loadQuestHeroProfile } from '$lib/stores/questHero';
	import { onMount } from 'svelte';

	let { quest, raiseName = null }: { quest: QuestState; raiseName?: string | null } = $props();

	let lang = $derived($resolvedLocale);
	let profile = $state<QuestHeroProfile | null>(null);
	let xp = $derived(heroXpProgress(quest.hero.totalXp));
	let hint = $derived(questDailyHint(quest, raiseName));
	let stats = $derived(heroDisplayStats({ profile, sessions: $live.history }));
	let fillPct = $derived(Math.min(1, xp.xpInLevel / xp.xpForLevel));
	let name = $derived(profile?.displayName.trim() || translate(lang, 'quest.heroNameless'));

	onMount(() => {
		profile = loadQuestHeroProfile();
	});

	let chapterLabel = $derived.by(() => {
		const c = quest.campaign;
		if (!c) return '';
		if (c.status === 'completed') return translate(lang, 'quest.campaignDone');
		if (c.status === 'paused') return translate(lang, 'quest.campaignPaused');
		return translate(lang, 'quest.chapter', {
			n: String(c.chapterIndex + 1),
			total: String(STARTER_CAMPAIGN_CHAPTERS)
		});
	});

	let hintText = $derived.by(() => {
		if (hint.key === 'quest.dailyRaise') return translate(lang, hint.key, { name: hint.vars.name });
		if (hint.key === 'quest.dailyWeekly') return translate(lang, hint.key, { n: String(hint.vars.n) });
		if (hint.key === 'quest.dailySession') return translate(lang, hint.key, { xp: String(hint.vars.xp) });
		return translate(lang, hint.key);
	});

	let pills = $derived([
		{ key: 'quest.statStrength', value: String(stats.strength) },
		{ key: 'quest.statMass', value: String(stats.mass) },
		{ key: 'quest.statEndurance', value: String(stats.endurance) },
		{ key: 'quest.onboardWeight', value: profile?.weightKg != null ? String(profile.weightKg) : '-' },
		{ key: 'quest.onboardHeight', value: profile?.heightCm != null ? String(profile.heightCm) : '-' },
		{ key: 'quest.onboardAge', value: profile?.age != null ? String(profile.age) : '-' }
	]);
</script>

<AppPanel class="quest-home text-left">
	<div class="quest-home__row">
		<HeroFigure sex={profile?.sex ?? null} size={88} />
		<div class="quest-home__copy">
			<p class="quest-home__name">{name}</p>
			<div class="quest-home__level-row">
				<p class="quest-home__level">{translate(lang, 'quest.levelLine', { level: String(xp.level) })}</p>
				<p class="quest-home__xp tabular-nums">
					{translate(lang, 'quest.xpBar', {
						current: String(xp.xpInLevel),
						max: String(xp.xpForLevel)
					})}
				</p>
			</div>
			<div
				class="quest-home__track"
				role="progressbar"
				aria-valuemin={0}
				aria-valuemax={xp.xpForLevel}
				aria-valuenow={xp.xpInLevel}
			>
				<div class="quest-home__fill" style:width="{Math.round(fillPct * 100)}%"></div>
			</div>
			{#if quest.streakBroken}
				<p class="quest-home__chip quest-home__chip--broken">{translate(lang, 'quest.streakBroken')}</p>
			{:else if quest.streakWeeks >= 2}
				<p class="quest-home__chip">{translate(lang, 'quest.streakBonus')}</p>
			{/if}
			{#if chapterLabel}
				<p class="quest-home__meta">{chapterLabel}</p>
			{/if}
		</div>
	</div>
	<ul class="quest-home__pills">
		{#each pills as pill (pill.key)}
			<li>
				<span>{translate(lang, pill.key)}</span>
				<strong class="tabular-nums">{pill.value}</strong>
			</li>
		{/each}
	</ul>
	<div class="quest-home__daily">
		<p class="quest-home__daily-label">{translate(lang, 'quest.dailyTitle')}</p>
		<p class="quest-home__daily-text">{hintText}</p>
	</div>
</AppPanel>

<style>
	.quest-home__row {
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}
	.quest-home__copy {
		flex: 1;
		min-width: 0;
	}
	.quest-home__name {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 800;
	}
	.quest-home__level-row {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		margin-top: 0.2rem;
	}
	.quest-home__level,
	.quest-home__xp {
		margin: 0;
		font-size: 0.8125rem;
	}
	.quest-home__track {
		margin-top: 0.35rem;
		height: 8px;
		border-radius: 999px;
		background: var(--color-border);
		overflow: hidden;
	}
	.quest-home__fill {
		height: 100%;
		background: var(--color-xp);
	}
	.quest-home__chip {
		margin: 0.4rem 0 0;
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--color-xp);
	}
	.quest-home__chip--broken {
		color: var(--color-danger);
	}
	.quest-home__meta {
		margin: 0.25rem 0 0;
		font-size: 0.75rem;
		opacity: 0.75;
	}
	.quest-home__pills {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.35rem;
		margin: 0.75rem 0 0;
		padding: 0;
		list-style: none;
	}
	.quest-home__pills li {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		min-height: 48px;
		justify-content: center;
		padding: 0.35rem 0.5rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--color-text) 8%, transparent);
		font-size: 0.6875rem;
	}
	.quest-home__daily {
		margin-top: 0.75rem;
	}
	.quest-home__daily-label {
		margin: 0;
		font-size: 0.6875rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		opacity: 0.7;
	}
	.quest-home__daily-text {
		margin: 0.2rem 0 0;
		font-size: 0.9375rem;
	}
</style>
