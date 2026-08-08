<script lang="ts">
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { translate } from '$lib/i18n/messages';
	import { auth } from '$lib/stores/auth';
	import { plans } from '$lib/stores/plans';
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
				month: 'short',
				year: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
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
			{#if $auth.user}
				{translate(lang, 'workouts.cloud')}
			{:else}
				{translate(lang, 'workouts.local')}
				<a class="text-[var(--color-accent)] underline" href="/auth">{translate(lang, 'workouts.signInSync')}</a
				>{translate(lang, 'workouts.syncSuffix')}
			{/if}
		</p>
	</div>

	{#if $plans.length === 0}
		<EmptyState
			title={translate(lang, 'workouts.emptyTitle')}
			description={translate(lang, 'workouts.emptyDesc')}
			actionHref="/builder"
			actionLabel={translate(lang, 'workouts.openBuilder')}
		/>
	{:else}
		<ul class="flex flex-col gap-3">
			{#each $plans as plan (plan.id)}
				<li class="list-row">
					<div>
						<h2 class="text-lg font-semibold">{plan.name}</h2>
						<p class="text-sm text-[var(--color-muted)]">
							{translate(lang, 'workouts.exCount', { n: plan.exercises.length })} · {formatDate(
								plan.updatedAt
							)}
						</p>
					</div>
					<div class="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
						<a class="btn-primary col-span-2 sm:col-span-1" href={`/builder/${plan.id}`}
							>{translate(lang, 'workouts.open')}</a
						>
						<button type="button" class="btn-secondary" onclick={() => void onDuplicate(plan.id)}>
							{translate(lang, 'workouts.duplicate')}
						</button>
						<button
							type="button"
							class="btn-danger"
							onclick={() => void onRemove(plan.id, plan.name)}
						>
							{translate(lang, 'workouts.delete')}
						</button>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>
