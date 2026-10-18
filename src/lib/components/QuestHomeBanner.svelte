<script lang="ts">
	import AppPanel from '$lib/components/AppPanel.svelte';
	import {
		STARTER_CAMPAIGN_CHAPTERS,
		heroXpProgress,
		questDailyHint,
		type QuestState
	} from '$lib/domain/quest';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	let { state }: { state: QuestState } = $props();

	let lang = $derived($resolvedLocale);
	let xp = $derived(heroXpProgress(state.hero.totalXp));
	let hint = $derived(questDailyHint(state));
	let weekProgress = $derived(
		`${state.week.countedSessionIds.length}/${state.weeklyGoal}`
	);
	let fillPct = $derived(Math.min(1, xp.xpInLevel / xp.xpForLevel));

	let chapterLabel = $derived.by(() => {
		const c = state.campaign;
		if (!c) return '-';
		if (c.status === 'completed') return translate(lang, 'quest.campaignDone');
		if (c.status === 'paused') return translate(lang, 'quest.campaignPaused');
		return translate(lang, 'quest.chapter', {
			n: String(c.chapterIndex + 1),
			total: String(STARTER_CAMPAIGN_CHAPTERS)
		});
	});

	let hintText = $derived.by(() => {
		if (hint.key === 'quest.dailyWeekly') {
			return translate(lang, hint.key, { n: String(hint.vars.n) });
		}
		if (hint.key === 'quest.dailySession') {
			return translate(lang, hint.key, { xp: String(hint.vars.xp) });
		}
		return translate(lang, hint.key);
	});
</script>

<AppPanel class="quest-home text-left">
	<p class="quest-home__kicker">{translate(lang, 'quest.homeKicker')}</p>
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
	<p class="quest-home__meta">
		{translate(lang, 'quest.weekLine', { progress: weekProgress })}
		·
		{chapterLabel}
	</p>
	<div class="quest-home__daily">
		<p class="quest-home__daily-label">{translate(lang, 'quest.dailyTitle')}</p>
		<p class="quest-home__daily-text">{hintText}</p>
	</div>
</AppPanel>

<style>
	.quest-home__kicker {
		margin: 0;
		font-size: 0.6875rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		opacity: 0.75;
	}
	.quest-home__level-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
		margin-top: 0.35rem;
	}
	.quest-home__level {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 800;
	}
	.quest-home__xp {
		margin: 0;
		font-size: 0.8125rem;
		font-weight: 600;
		opacity: 0.75;
	}
	.quest-home__track {
		margin-top: 0.5rem;
		height: 0.5rem;
		border-radius: var(--radius-sm, 6px);
		background: var(--color-border);
		overflow: hidden;
	}
	.quest-home__fill {
		height: 100%;
		background: var(--color-accent);
		border-radius: inherit;
	}
	.quest-home__meta {
		margin: 0.5rem 0 0;
		font-size: 0.8125rem;
		opacity: 0.8;
		line-height: 1.35;
	}
	.quest-home__daily {
		margin-top: 0.65rem;
		padding-top: 0.65rem;
		border-top: 1px solid var(--color-border);
	}
	.quest-home__daily-label {
		margin: 0;
		font-size: 0.6875rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		opacity: 0.75;
	}
	.quest-home__daily-text {
		margin: 0.25rem 0 0;
		font-size: 0.9375rem;
		font-weight: 600;
		line-height: 1.35;
	}
</style>
