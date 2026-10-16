<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppPanel from '$lib/components/AppPanel.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import { buildCoachHints } from '$lib/domain/coachHints';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { labelBodyPart } from '$lib/domain/labels.ru';
	import { loadExerciseIndexWithCustoms } from '$lib/data/exerciseIndexWithCustoms';
	import type { ExerciseIndexItem } from '$lib/domain/types';
	import { translate, translateError } from '$lib/i18n/messages';
	import SeoHead from '$lib/seo/SeoHead.svelte';
	import { appendExerciseToHomePlan } from '$lib/workout/planPatch';
	import { live } from '$lib/stores/live';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let lang = $derived($resolvedLocale);
	let indexById = $state(new Map<string, ExerciseIndexItem>());

	onMount(() => {
		void loadExerciseIndexWithCustoms().then((index) => {
			indexById = new Map(index.map((ex) => [ex.id, ex]));
		});
	});

	let hints = $derived.by(() => {
		const finished = $live.history
			.filter((s) => s.finishedAt)
			.sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''));
		const focus = finished[0];
		if (!focus || indexById.size === 0) return [];
		const catalog = [...indexById.values()];
		const bodyPartFor = (id: string) => indexById.get(id)?.body_part ?? null;
		return buildCoachHints(focus, finished, catalog, bodyPartFor);
	});

	async function addHint(exerciseId: string) {
		try {
			const planId = await appendExerciseToHomePlan(exerciseId);
			if (!planId) {
				toasts.show(translate(lang, 'coach.noPlan'), 'error');
				return;
			}
			toasts.show(translate(lang, 'coach.added'), 'success');
			await goto(`/builder/${planId}`);
		} catch (err) {
			toasts.show(translateError(lang, err, 'common.error'), 'error');
		}
	}
</script>

<SeoHead title={translate(lang, 'nav.coach')} noindex />

<section class="content-page content-page--narrow pb-mobile-actions">
	<ScreenHeader
		title={translate(lang, 'nav.coach')}
		backHref="/auth"
		backLabelVisible
		preferHistoryBack
	/>
	<p class="coach-lead">{translate(lang, 'coach.lead')}</p>
	{#if hints.length === 0}
		<AppPanel class="text-left">
			<p class="coach-muted">{translate(lang, 'coach.empty')}</p>
		</AppPanel>
	{:else}
		{#each hints as hint (hint.id)}
			{@const meta = indexById.get(hint.exerciseId)}
			<AppPanel class="coach-card text-left">
				<p class="coach-card__title">
					{meta ? exerciseName(meta, lang) : hint.exerciseId}
				</p>
				<p class="coach-card__meta">
					{labelBodyPart(hint.bodyPart, lang)} · {translate(lang, hint.reasonKey)}
				</p>
				<AppButton onclick={() => void addHint(hint.exerciseId)}>
					{translate(lang, 'coach.addToPlan')}
				</AppButton>
			</AppPanel>
		{/each}
	{/if}
</section>

<style>
	.coach-lead {
		margin: 0 0 1rem;
		font-size: 0.9375rem;
		opacity: 0.8;
		line-height: 1.4;
	}
	.coach-muted {
		margin: 0;
		opacity: 0.75;
		line-height: 1.4;
	}
	.coach-card {
		margin-bottom: 0.75rem;
	}
	.coach-card__title {
		margin: 0;
		font-weight: 800;
		font-size: 1.0625rem;
	}
	.coach-card__meta {
		margin: 0.35rem 0 0.75rem;
		font-size: 0.875rem;
		opacity: 0.75;
	}
</style>
