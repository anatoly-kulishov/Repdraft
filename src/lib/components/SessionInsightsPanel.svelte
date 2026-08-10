<script lang="ts">
	import {
		currentWeekSummary,
		insightsChartMode,
		recentFinishedSessions,
		sessionDerivedPrs,
		sessionVolumeKg,
		weeklyVolumeSeries,
		type WeekBucket
	} from '$lib/domain/insights';
	import { completedSetCount, totalSetCount } from '$lib/domain/session';
	import { exerciseName } from '$lib/domain/exerciseName';
	import type { ExerciseIndexItem, WorkoutSession } from '$lib/domain/types';
	import { loadExerciseIndex } from '$lib/data/loadExercises';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import { translate } from '$lib/i18n/messages';
	import { live } from '$lib/stores/live';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';
	import { Trash2 } from '@lucide/svelte';

	let { sessions }: { sessions: WorkoutSession[] } = $props();

	let lang = $derived($resolvedLocale);
	let index = $state<ExerciseIndexItem[]>([]);
	let indexReady = $state(false);
	let busyId = $state<string | null>(null);

	$effect(() => {
		let cancelled = false;
		void loadExerciseIndex()
			.then((rows) => {
				if (!cancelled) {
					index = rows;
					indexReady = true;
				}
			})
			.catch(() => {
				if (!cancelled) indexReady = true;
			});
		return () => {
			cancelled = true;
		};
	});

	let finished = $derived(sessions.filter((s) => s.finishedAt));
	let week = $derived(currentWeekSummary(finished));
	let series = $derived(weeklyVolumeSeries(finished, 8));
	let prs = $derived(sessionDerivedPrs(finished, 5));
	let recent = $derived(recentFinishedSessions(finished, 8));
	let chartMode = $derived(insightsChartMode(series));
	let maxVolume = $derived(Math.max(1, ...series.map((b) => b.volumeKg)));
	let maxSessions = $derived(Math.max(1, ...series.map((b) => b.sessionCount)));

	function nameFor(id: string): string {
		const item = index.find((x) => x.id === id);
		if (item) return exerciseName(item, lang);
		return translate(lang, 'records.fallback', { id });
	}

	function formatDate(iso: string): string {
		try {
			return new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'en-US', {
				day: 'numeric',
				month: 'short'
			}).format(new Date(iso));
		} catch {
			return iso;
		}
	}

	function formatWeekLabel(bucket: WeekBucket): string {
		try {
			const [y, m, d] = bucket.weekKey.split('-').map(Number);
			const monday = new Date(y!, m! - 1, d!);
			return new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'en-US', {
				day: 'numeric',
				month: 'short'
			}).format(monday);
		} catch {
			return bucket.weekKey;
		}
	}

	function formatKg(n: number): string {
		if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
		return String(Math.round(n));
	}

	async function onRemoveSession(session: WorkoutSession) {
		if (!confirm(translate(lang, 'workouts.confirmDeleteSession', { name: session.planName }))) {
			return;
		}
		busyId = session.id;
		try {
			await live.removeFromHistory(session.id);
			toasts.show(translate(lang, 'workouts.sessionDeleted'), 'info');
		} catch {
			toasts.show(translate(lang, 'workouts.sessionDeleteFail'), 'error');
		} finally {
			busyId = null;
		}
	}

	async function onClearHistory() {
		if (!confirm(translate(lang, 'workouts.confirmClearHistory'))) return;
		busyId = '__clear__';
		try {
			await live.clearHistory();
			toasts.show(translate(lang, 'workouts.historyCleared'), 'info');
		} catch {
			toasts.show(translate(lang, 'workouts.historyClearFail'), 'error');
		} finally {
			busyId = null;
		}
	}
</script>

<section class="panel mb-4" aria-labelledby="insights-heading">
	<div class="mb-3">
		<h2 id="insights-heading" class="section-title">{translate(lang, 'insights.title')}</h2>
		<p class="mt-1 text-xs text-[var(--color-muted)]">{translate(lang, 'insights.lead')}</p>
	</div>

	{#if finished.length === 0}
		<div class="panel-dashed py-4 text-center md:py-6">
			<p class="text-sm font-medium">{translate(lang, 'insights.emptyTitle')}</p>
			<p class="mt-1 text-xs text-[var(--color-muted)]">
				{translate(lang, 'insights.emptyDesc')}
			</p>
			<a class="btn-primary mt-3 inline-flex text-sm" href="/builder">
				{translate(lang, 'workouts.openBuilder')}
			</a>
		</div>
	{:else}
		<div class="grid gap-3 sm:grid-cols-2">
			<div class="panel-inset !p-3">
				<p class="text-xs font-medium text-[var(--color-muted)]">
					{translate(lang, 'insights.thisWeek')}
				</p>
				<p class="mt-1 text-lg font-semibold tabular-nums text-[var(--color-ink)]">
					{translate(lang, 'insights.weekSessions', { n: week.sessionCount })}
				</p>
				<p class="text-sm text-[var(--color-muted)]">
					{translate(lang, 'insights.weekVolume', { kg: formatKg(week.volumeKg) })}
				</p>
			</div>
			<div class="panel-inset !p-3">
				<p class="text-xs font-medium text-[var(--color-muted)]">
					{translate(lang, 'insights.totalSessions')}
				</p>
				<p class="mt-1 text-lg font-semibold tabular-nums text-[var(--color-ink)]">
					{finished.length}
				</p>
				<p class="text-sm text-[var(--color-muted)]">
					{translate(
						lang,
						chartMode === 'frequency' ? 'insights.frequencyHint' : 'insights.volumeHint'
					)}
				</p>
			</div>
		</div>

		<div class="mt-4">
			<p class="mb-2 text-sm font-semibold">
				{translate(
					lang,
					chartMode === 'frequency' ? 'insights.frequencyChart' : 'insights.volumeChart'
				)}
			</p>
			<div
				class="flex h-32 items-end gap-1.5 sm:gap-2"
				role="img"
				aria-label={translate(
					lang,
					chartMode === 'frequency' ? 'insights.frequencyChart' : 'insights.volumeChart'
				)}
			>
				{#each series as bucket (bucket.weekKey)}
					{@const value = chartMode === 'frequency' ? bucket.sessionCount : bucket.volumeKg}
					{@const max = chartMode === 'frequency' ? maxSessions : maxVolume}
					{@const barPx = value <= 0 ? 2 : Math.max(6, Math.round((value / max) * 88))}
					{@const topLabel =
						chartMode === 'frequency'
							? bucket.sessionCount > 0
								? String(bucket.sessionCount)
								: ''
							: bucket.volumeKg > 0
								? formatKg(bucket.volumeKg)
								: ''}
					<div class="flex min-w-0 flex-1 flex-col items-center gap-1">
						<span class="h-3 text-[10px] tabular-nums text-[var(--color-muted)]">{topLabel}</span>
						<div class="flex h-[5.5rem] w-full max-w-[2.25rem] flex-col justify-end">
							<div
								class="w-full rounded-t-md bg-[var(--color-accent)]"
								style={`height: ${barPx}px`}
								title={`${formatWeekLabel(bucket)}: ${formatKg(bucket.volumeKg)} kg · ${bucket.sessionCount}`}
							></div>
						</div>
						<span class="truncate text-[10px] text-[var(--color-muted)]"
							>{formatWeekLabel(bucket)}</span
						>
					</div>
				{/each}
			</div>
		</div>

		{#if prs.length > 0 && indexReady}
			<div class="mt-4">
				<p class="mb-2 text-sm font-semibold">{translate(lang, 'insights.bestLifts')}</p>
				<ul class="flex flex-col gap-2">
					{#each prs as pr (pr.exerciseId)}
						<li class="flex items-baseline justify-between gap-2 text-sm">
							<a
								class="min-w-0 truncate font-medium text-[var(--color-ink)] underline-offset-2 hover:text-[var(--color-accent)] hover:underline"
								href={`/exercise/${pr.exerciseId}`}
							>
								{nameFor(pr.exerciseId)}
							</a>
							<span class="shrink-0 tabular-nums text-[var(--color-muted)]">
								{pr.weightKg}×{pr.reps}
								<span class="text-[11px]">· {formatDate(pr.finishedAt)}</span>
							</span>
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		{#if recent.length > 0}
			<div class="mt-4">
				<div class="mb-2 flex flex-wrap items-center justify-between gap-2">
					<p class="text-sm font-semibold">{translate(lang, 'workouts.historyTitle')}</p>
					<button
						type="button"
						class="btn-link text-xs !text-[var(--color-muted)]"
						disabled={busyId !== null}
						aria-busy={busyId === '__clear__'}
						onclick={() => void onClearHistory()}
					>
						{#if busyId === '__clear__'}
							<span class="inline-flex items-center gap-1.5">
								<Spinner size="sm" block={false} />
								{translate(lang, 'auth.wait')}
							</span>
						{:else}
							{translate(lang, 'workouts.clearHistory')}
						{/if}
					</button>
				</div>
				<ul class="flex flex-col gap-2">
					{#each recent as session (session.id)}
						<li class="panel-inset flex items-center justify-between gap-2 !p-2.5 text-sm">
							<div class="min-w-0 flex-1">
								<p class="truncate font-medium">{session.planName}</p>
								<p class="text-xs text-[var(--color-muted)]">
									{formatDate(session.finishedAt!)} ·
									{translate(lang, 'live.progress', {
										done: completedSetCount(session),
										total: totalSetCount(session)
									})}
									· {formatKg(sessionVolumeKg(session))} kg
								</p>
							</div>
							<button
								type="button"
								class="btn-ghost is-danger shrink-0"
								disabled={busyId !== null}
								aria-busy={busyId === session.id}
								aria-label={translate(lang, 'workouts.deleteSession')}
								title={translate(lang, 'workouts.deleteSession')}
								onclick={() => void onRemoveSession(session)}
							>
								{#if busyId === session.id}
									<Spinner size="sm" block={false} />
								{:else}
									<LucideIcon icon={Trash2} size={ICON_SMALL} />
								{/if}
							</button>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	{/if}
</section>
