<script lang="ts">
	import EmptyState from '$lib/components/EmptyState.svelte';
	import PageSkeleton from '$lib/components/PageSkeleton.svelte';
	import { translate } from '$lib/i18n/messages';
	import { auth } from '$lib/stores/auth';
	import { plans, plansReady } from '$lib/stores/plans';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';
	import { onMount } from 'svelte';

	let lang = $derived($resolvedLocale);

	onMount(() => {
		void plans.refresh();
	});

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

	async function onDuplicate(id: string) {
		try {
			const copy = await plans.duplicate(id);
			if (copy) toasts.show(translate(lang, 'workouts.copied'), 'success');
		} catch (err) {
			toasts.show(err instanceof Error ? err.message : 'Error', 'error');
		}
	}

	async function onRemove(id: string, name: string) {
		if (!confirm(translate(lang, 'workouts.confirmDelete', { name }))) return;
		try {
			await plans.removePlan(id);
			toasts.show(translate(lang, 'workouts.deleted'), 'info');
		} catch (err) {
			toasts.show(err instanceof Error ? err.message : 'Error', 'error');
		}
	}
</script>

<svelte:head>
	<title>{translate(lang, 'workouts.title')} — Repdraft</title>
</svelte:head>

<section>
	<div class="page-header">
		<h1 class="page-title">{translate(lang, 'workouts.title')}</h1>
		<p class="page-lead">
			{#if !$auth.ready}
				<span
					class="inline-block h-4 w-48 max-w-full animate-pulse rounded bg-[var(--color-surface-muted)]"
					aria-hidden="true"
				></span>
			{:else if $auth.user}
				{translate(lang, 'workouts.cloud')}
			{:else}
				{translate(lang, 'workouts.local')}
				<a class="font-semibold text-[var(--color-accent)] underline" href="/auth"
					>{translate(lang, 'workouts.signInSync')}</a
				>{translate(lang, 'workouts.syncSuffix')}
			{/if}
		</p>
	</div>

	{#if !$plansReady}
		<PageSkeleton rows={3} />
	{:else if $plans.length === 0}
		<EmptyState
			title={translate(lang, 'workouts.emptyTitle')}
			description={translate(lang, 'workouts.emptyDesc')}
			actionHref="/builder"
			actionLabel={translate(lang, 'workouts.openBuilder')}
		/>
	{:else}
		<ul class="soft-enter flex flex-col gap-2.5">
			{#each $plans as plan (plan.id)}
				<li class="list-row !gap-3 !py-3.5">
					<a
						class="group flex min-w-0 flex-1 items-center gap-2 no-underline"
						href={`/builder/${plan.id}`}
					>
						<span class="min-w-0 flex-1">
							<h2
								class="text-base font-semibold leading-snug text-[var(--color-ink)] transition-colors group-hover:text-[var(--color-accent)]"
							>
								{plan.name}
							</h2>
							<p class="mt-0.5 text-sm text-[var(--color-muted)]">
								{translate(lang, 'workouts.exCount', { n: plan.exercises.length })} · {formatDate(
									plan.updatedAt
								)}
							</p>
						</span>
						<svg
							viewBox="0 0 24 24"
							class="h-5 w-5 shrink-0 text-[var(--color-muted)] transition-colors group-hover:text-[var(--color-accent)]"
							aria-hidden="true"
						>
							<path
								d="M9 6l6 6-6 6"
								fill="none"
								stroke="currentColor"
								stroke-width="1.8"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
					</a>
					<div class="flex shrink-0 items-center gap-1">
						<button
							type="button"
							class="btn-ghost"
							aria-label={translate(lang, 'workouts.duplicate')}
							title={translate(lang, 'workouts.duplicate')}
							onclick={() => void onDuplicate(plan.id)}
						>
							<svg viewBox="0 0 24 24" class="h-[1.15rem] w-[1.15rem]" aria-hidden="true">
								<rect
									x="8"
									y="8"
									width="12"
									height="12"
									rx="2"
									fill="none"
									stroke="currentColor"
									stroke-width="1.8"
								/>
								<path
									d="M4 16V6a2 2 0 0 1 2-2h10"
									fill="none"
									stroke="currentColor"
									stroke-width="1.8"
									stroke-linecap="round"
								/>
							</svg>
						</button>
						<button
							type="button"
							class="btn-ghost is-danger"
							aria-label={translate(lang, 'workouts.delete')}
							title={translate(lang, 'workouts.delete')}
							onclick={() => void onRemove(plan.id, plan.name)}
						>
							<svg viewBox="0 0 24 24" class="h-[1.15rem] w-[1.15rem]" aria-hidden="true">
								<path
									d="M6 6l12 12M18 6L6 18"
									fill="none"
									stroke="currentColor"
									stroke-width="1.8"
									stroke-linecap="round"
								/>
							</svg>
						</button>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>
