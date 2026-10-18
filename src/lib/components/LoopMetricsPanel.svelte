<script lang="ts">
	import { computeLoopMetrics, formatRatePercent } from '$lib/domain/loopMetrics';
	import { translate } from '$lib/i18n/messages';
	import { live } from '$lib/stores/live';
	import { resolvedLocale } from '$lib/stores/locale';

	let lang = $derived($resolvedLocale);
	let snap = $derived(computeLoopMetrics($live.history, new Date().toISOString()));
</script>

<div class="profile-settings-group panel profile-settings-stack-full" role="region">
	<p class="profile-settings-group__title">{translate(lang, 'loopMetrics.title')}</p>
	<p class="profile-settings-group__hint">{translate(lang, 'loopMetrics.hint')}</p>
	<dl class="loop-metrics-grid">
		<div>
			<dt>{translate(lang, 'loopMetrics.started')}</dt>
			<dd class="tabular-nums">{snap.sessionStarted}</dd>
		</div>
		<div>
			<dt>{translate(lang, 'loopMetrics.finished')}</dt>
			<dd class="tabular-nums">{snap.sessionFinished}</dd>
		</div>
		<div>
			<dt>{translate(lang, 'loopMetrics.completion')}</dt>
			<dd class="tabular-nums">{formatRatePercent(snap.completionRate)}</dd>
		</div>
		<div>
			<dt>{translate(lang, 'loopMetrics.activation')}</dt>
			<dd>
				{#if snap.activatedWithin7d == null}
					-
				{:else}
					{translate(lang, snap.activatedWithin7d ? 'loopMetrics.yes' : 'loopMetrics.no')}
				{/if}
			</dd>
		</div>
		<div>
			<dt>{translate(lang, 'loopMetrics.week4')}</dt>
			<dd>
				{#if snap.week4Retained == null}
					-
				{:else}
					{translate(lang, snap.week4Retained ? 'loopMetrics.yes' : 'loopMetrics.no')}
				{/if}
			</dd>
		</div>
	</dl>
</div>

<style>
	.loop-metrics-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem 1rem;
		margin: 0.75rem 0 0;
	}
	.loop-metrics-grid dt {
		margin: 0;
		font-size: 0.75rem;
		opacity: 0.7;
	}
	.loop-metrics-grid dd {
		margin: 0.15rem 0 0;
		font-size: 1rem;
		font-weight: 600;
	}
</style>
