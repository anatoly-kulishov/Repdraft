<script lang="ts">
	import AppPanel from '$lib/components/AppPanel.svelte';
	import { heroLevel, STARTER_CAMPAIGN_CHAPTERS } from '$lib/domain/quest';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { questEnabled } from '$lib/stores/prefs';
	import { questLastApply, questState } from '$lib/stores/quest';

	let lang = $derived($resolvedLocale);
	let enabled = $derived($questEnabled);
	let apply = $derived($questLastApply);
	let state = $derived($questState);
	let level = $derived(heroLevel(state.hero.totalXp));
	let weekProgress = $derived(
		`${state.week.countedSessionIds.length}/${state.weeklyGoal}`
	);
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
	let show = $derived(enabled && apply != null && (apply.xpGained > 0 || apply.counted));
</script>

{#if show && apply}
	<AppPanel class="quest-summary text-left" role="status">
		<p class="quest-summary__title">{translate(lang, 'quest.summaryTitle')}</p>
		<p class="quest-summary__xp">
			{translate(lang, 'quest.xpGained', { xp: String(apply.xpGained) })}
		</p>
		<p class="quest-summary__meta">
			{translate(lang, 'quest.levelLine', { level: String(level) })}
			·
			{translate(lang, 'quest.weekLine', { progress: weekProgress })}
		</p>
		<p class="quest-summary__meta">{chapterLabel}</p>
		{#if apply.goalJustMet}
			<p class="quest-summary__badge">{translate(lang, 'quest.goalMet')}</p>
		{/if}
	</AppPanel>
{/if}

<style>
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
	}
	.quest-summary__meta {
		margin: 0.35rem 0 0;
		font-size: 0.875rem;
		opacity: 0.8;
	}
	.quest-summary__badge {
		margin: 0.5rem 0 0;
		font-size: 0.875rem;
		font-weight: 600;
	}
</style>
