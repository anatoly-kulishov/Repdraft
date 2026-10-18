<script lang="ts">
	import AppPanel from '$lib/components/AppPanel.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import { computeProgressOverview } from '$lib/domain/progressOverview';
	import { translate } from '$lib/i18n/messages';
	import SeoHead from '$lib/seo/SeoHead.svelte';
	import { live } from '$lib/stores/live';
	import { resolvedLocale } from '$lib/stores/locale';

	let lang = $derived($resolvedLocale);
	let overview = $derived(computeProgressOverview($live.history));
	let maxWeekVol = $derived(Math.max(1, ...overview.weeks.map((w) => w.volumeKg)));
</script>

<SeoHead title={translate(lang, 'nav.progress')} noindex />

<section class="content-page content-page--narrow pb-mobile-actions">
	<ScreenHeader
		title={translate(lang, 'nav.progress')}
		backHref="/auth"
		backLabelVisible
		preferHistoryBack
	/>
	<p class="progress-lead">{translate(lang, 'progress.lead')}</p>
	<div class="progress-stats">
		<div class="progress-stat panel">
			<p class="progress-stat__label">{translate(lang, 'progress.workouts30d')}</p>
			<p class="progress-stat__value tabular-nums">{overview.workouts30d}</p>
		</div>
		<div class="progress-stat panel">
			<p class="progress-stat__label">{translate(lang, 'progress.volume30d')}</p>
			<p class="progress-stat__value tabular-nums">{overview.volume30dKg}</p>
		</div>
	</div>
	<AppPanel class="text-left">
		<p class="progress-section-title">{translate(lang, 'progress.volumeByWeek')}</p>
		{#if overview.weeks.length === 0}
			<p class="progress-muted">{translate(lang, 'progress.empty')}</p>
			<a href="/" class="btn-primary progress-empty-cta">{translate(lang, 'progress.emptyCta')}</a>
		{:else}
			{#each overview.weeks as w (w.weekKey)}
				<div class="progress-week">
					<span class="progress-week__label tabular-nums">{w.weekKey.slice(5)}</span>
					<div class="progress-week__track">
						<div
							class="progress-week__fill"
							style:width="{Math.round((w.volumeKg / maxWeekVol) * 100)}%"
						></div>
					</div>
					<span class="progress-week__meta tabular-nums">{w.volumeKg} · {w.workouts}</span>
				</div>
			{/each}
		{/if}
	</AppPanel>
</section>

<style>
	.progress-lead {
		margin: 0 0 1rem;
		font-size: 0.9375rem;
		opacity: 0.8;
		line-height: 1.4;
	}
	.progress-stats {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.65rem;
		margin-bottom: 1rem;
	}
	.progress-stat {
		padding: 0.85rem 1rem;
	}
	.progress-stat__label {
		margin: 0;
		font-size: 0.75rem;
		opacity: 0.75;
	}
	.progress-stat__value {
		margin: 0.25rem 0 0;
		font-size: 1.5rem;
		font-weight: 800;
	}
	.progress-section-title {
		margin: 0 0 0.65rem;
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		opacity: 0.75;
	}
	.progress-muted {
		margin: 0;
		opacity: 0.75;
	}
	.progress-empty-cta {
		display: inline-flex;
		margin-top: 0.75rem;
		min-height: 3rem;
		align-items: center;
	}
	.progress-week {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.65rem;
	}
	.progress-week__label {
		width: 3rem;
		font-size: 0.8125rem;
		font-weight: 600;
		opacity: 0.75;
	}
	.progress-week__track {
		flex: 1;
		height: 0.625rem;
		border-radius: var(--radius-sm, 6px);
		background: var(--color-border);
		overflow: hidden;
	}
	.progress-week__fill {
		height: 100%;
		background: var(--color-accent);
	}
	.progress-week__meta {
		width: 4.5rem;
		text-align: right;
		font-size: 0.75rem;
		opacity: 0.75;
	}
</style>
