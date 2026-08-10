<script lang="ts">
	import EmptyState from '$lib/components/EmptyState.svelte';
	import PageSkeleton from '$lib/components/PageSkeleton.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import SubrouteBack from '$lib/components/SubrouteBack.svelte';
	import { loadExerciseIndex } from '$lib/data/loadExercises';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { completedSetCount, sessionDurationMs } from '$lib/domain/session';
	import type { ExerciseIndexItem, WorkoutSession } from '$lib/domain/types';
	import { translate, translateError } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { live } from '$lib/stores/live';
	import { toasts } from '$lib/stores/toasts';
	import { localSessionRepository } from '$lib/storage/localSessionRepository';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { ICON_BUTTON, ICON_SMALL } from '$lib/components/icons/sizes';
	import { Trash2 } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	let lang = $derived($resolvedLocale);
	let session = $state<WorkoutSession | null>(null);
	let names = $state<Map<string, ExerciseIndexItem>>(new Map());
	let missing = $state(false);
	let loading = $state(true);
	let deleting = $state(false);

	onMount(() => {
		void (async () => {
			const id = $page.params.id;
			if (!id) {
				missing = true;
				loading = false;
				return;
			}
			const found = await localSessionRepository.get(id);
			if (!found?.finishedAt) missing = true;
			else session = found;
			const index = await loadExerciseIndex();
			names = new Map(index.map((ex) => [ex.id, ex]));
			loading = false;
		})();
	});

	function formatWhen(iso: string): string {
		try {
			return new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'en-US', {
				day: 'numeric',
				month: 'short',
				year: 'numeric'
			}).format(new Date(iso));
		} catch {
			return iso;
		}
	}

	function formatDuration(ms: number | null): string {
		if (ms == null) return '—';
		const totalSec = Math.max(0, Math.floor(ms / 1000));
		const m = Math.floor(totalSec / 60);
		const s = totalSec % 60;
		return `${m}:${String(s).padStart(2, '0')}`;
	}

	function titleFor(exerciseId: string): string {
		const item = names.get(exerciseId);
		return item ? exerciseName(item, lang) : exerciseId;
	}

	async function onDeleteSession() {
		if (!session) return;
		if (!confirm(translate(lang, 'workouts.confirmDeleteSession', { name: session.planName }))) {
			return;
		}
		deleting = true;
		try {
			await live.removeFromHistory(session.id);
			toasts.show(translate(lang, 'workouts.sessionDeleted'), 'info');
			void goto('/workouts');
		} catch (err) {
			toasts.show(translateError(lang, err, 'workouts.sessionDeleteFail'), 'error');
			deleting = false;
		}
	}
</script>

{#snippet deleteHeaderAction()}
	<button
		type="button"
		class="btn-ghost is-danger"
		disabled={deleting}
		aria-busy={deleting}
		aria-label={translate(lang, 'workouts.deleteSession')}
		title={translate(lang, 'workouts.deleteSession')}
		onclick={() => void onDeleteSession()}
	>
		{#if deleting}
			<Spinner size="sm" block={false} />
		{:else}
			<LucideIcon icon={Trash2} size={ICON_BUTTON} />
		{/if}
	</button>
{/snippet}

<svelte:head>
	<title
		>{session ? session.planName : translate(lang, 'workouts.historyDetail')} — Repdraft</title
	>
</svelte:head>

{#if loading}
	<PageSkeleton rows={4} />
{:else if missing || !session}
	<EmptyState
		title={translate(lang, 'live.noPlan')}
		description={translate(lang, 'workouts.emptyDesc')}
		actionHref="/workouts"
		actionLabel={translate(lang, 'nav.workouts')}
	/>
{:else}
	<section class="content-page content-page--narrow soft-enter">
		<div class="md:hidden">
			<ScreenHeader
				title={session.planName}
				backHref="/workouts"
				actions={deleteHeaderAction}
			/>
		</div>
		<div class="subroute-desktop-head hidden md:block">
			<SubrouteBack href="/workouts" label={translate(lang, 'builder.backWorkouts')} />
			<h1 class="page-title">{session.planName}</h1>
		</div>
		<p class="page-lead mt-1 lg:mt-0">
			{formatWhen(session.finishedAt ?? session.startedAt)} · {formatDuration(
				sessionDurationMs(session)
			)} · {completedSetCount(session)} sets
		</p>

		<ul class="mt-6 flex flex-col gap-4">
			{#each session.exercises as ex (ex.exerciseId)}
				<li class="panel !p-4">
					<h2 class="text-base font-semibold text-[var(--color-ink)]">{titleFor(ex.exerciseId)}</h2>
					<ul class="mt-2 flex flex-col gap-1">
						{#each ex.sets.filter((s) => s.completed) as set, i (i)}
							<li class="text-sm tabular-nums text-[var(--color-muted)]">
								<span class="text-[var(--color-ink)]">{set.weightKg ?? '—'} kg</span>
								× {set.reps ?? '—'}
							</li>
						{/each}
					</ul>
				</li>
			{/each}
		</ul>

		<div class="mt-8 hidden md:block">
			<button
				type="button"
				class="btn-ghost is-danger inline-flex min-h-11 items-center gap-2 px-2"
				disabled={deleting}
				aria-busy={deleting}
				onclick={() => void onDeleteSession()}
			>
				{#if deleting}
					<Spinner size="sm" block={false} />
					{translate(lang, 'auth.wait')}
				{:else}
					<LucideIcon icon={Trash2} size={ICON_SMALL} />
					{translate(lang, 'workouts.deleteSession')}
				{/if}
			</button>
		</div>
	</section>
{/if}
