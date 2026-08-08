<script lang="ts">
	import { page } from '$app/stores';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { getExerciseById } from '$lib/data/loadExercises';
	import {
		labelBodyPart,
		labelEquipment,
		labelTarget
	} from '$lib/domain/labels.ru';
	import type { Exercise } from '$lib/domain/types';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { translate } from '$lib/i18n/messages';
	import { draft } from '$lib/stores/draft';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';
	import PersonalRecordPanel from '$lib/components/PersonalRecordPanel.svelte';
	import TechniqueClipsPanel from '$lib/components/TechniqueClipsPanel.svelte';

	let exercise = $state<Exercise | null>(null);
	let loading = $state(true);
	let notFound = $state(false);
	let lang = $derived($resolvedLocale);
	let title = $derived(exercise ? exerciseName(exercise, lang) : '');
	let steps = $derived.by(() => {
		if (!exercise) return [] as string[];
		const map = exercise.instruction_steps ?? {};
		return map[lang] ?? map.ru ?? map.en ?? [];
	});

	$effect(() => {
		const id = $page.params.id;
		let cancelled = false;
		loading = true;
		notFound = false;
		exercise = null;

		if (!id) {
			notFound = true;
			loading = false;
			return;
		}

		getExerciseById(id)
			.then((ex) => {
				if (cancelled) return;
				if (!ex) {
					notFound = true;
				} else {
					exercise = ex;
				}
				loading = false;
			})
			.catch(() => {
				if (!cancelled) {
					notFound = true;
					loading = false;
				}
			});

		return () => {
			cancelled = true;
		};
	});

	function addToDraft() {
		if (!exercise) return;
		const result = draft.addToDraft(exercise.id);
		if (result.added) {
			toasts.show(translate(lang, 'exercise.added'), 'success');
		} else {
			toasts.show(translate(lang, 'exercise.already'), 'info');
		}
	}
</script>

<svelte:head>
	<title>{exercise ? `${title} — Repdraft` : `${translate(lang, 'exercise.loading')} — Repdraft`}</title>
</svelte:head>

{#if loading}
	<p class="text-sm text-[var(--color-muted)]">{translate(lang, 'exercise.loading')}</p>
{:else if notFound || !exercise}
	<EmptyState
		title={translate(lang, 'exercise.notFoundTitle')}
		description={translate(lang, 'exercise.notFoundDesc')}
		actionHref="/"
		actionLabel={translate(lang, 'builder.toCatalog')}
	/>
{:else}
	<article class="grid gap-5 pb-28 lg:grid-cols-[280px_1fr] lg:gap-6 lg:pb-0">
		<div>
			<a href="/" class="mb-3 inline-flex text-sm font-medium text-[var(--color-accent)] md:hidden"
				>{translate(lang, 'exercise.back')}</a
			>
			<div class="panel overflow-hidden">
				<img
					src={`/${exercise.gif_url}`}
					alt={title}
					width="180"
					height="180"
					class="mx-auto h-[180px] w-[180px] object-contain"
				/>
			</div>
			<p class="mt-2 text-xs text-[var(--color-muted)]">{exercise.attribution}</p>
		</div>

		<div class="flex flex-col gap-4">
			<div>
				<p class="text-sm text-[var(--color-muted)]">{labelBodyPart(exercise.body_part, lang)}</p>
				<h1 class="page-title sm:text-3xl">{title}</h1>
			</div>

			<dl class="panel grid gap-3 !p-3 text-sm sm:grid-cols-2">
				<div>
					<dt class="text-[var(--color-muted)]">{translate(lang, 'exercise.equipment')}</dt>
					<dd class="font-medium">{labelEquipment(exercise.equipment, lang)}</dd>
				</div>
				<div>
					<dt class="text-[var(--color-muted)]">{translate(lang, 'exercise.target')}</dt>
					<dd class="font-medium">{labelTarget(exercise.target, lang)}</dd>
				</div>
				<div class="sm:col-span-2">
					<dt class="text-[var(--color-muted)]">{translate(lang, 'exercise.secondary')}</dt>
					<dd class="font-medium">
						{#if exercise.secondary_muscles.length}
							{exercise.secondary_muscles.map((m) => labelTarget(m, lang)).join(', ')}
						{:else}
							{translate(lang, 'exercise.dash')}
						{/if}
					</dd>
				</div>
			</dl>

			<div class="actions-inline !mb-0">
				<button type="button" class="btn-primary" onclick={addToDraft}
					>{translate(lang, 'exercise.addDraft')}</button
				>
				<a class="btn-secondary" href="/builder">{translate(lang, 'exercise.openBuilder')}</a>
			</div>

			<section>
				<h2 class="section-title mb-2">{translate(lang, 'exercise.howTo')}</h2>
				<ol class="list-decimal space-y-2.5 pl-5 text-sm leading-relaxed text-[var(--color-ink)]">
					{#each steps as step, i (i)}
						<li>{step}</li>
					{/each}
				</ol>
			</section>

			<PersonalRecordPanel exerciseId={exercise.id} />

			<TechniqueClipsPanel exerciseId={exercise.id} />
		</div>
	</article>

	<div class="sticky-actions">
		<div class="mx-auto grid max-w-6xl grid-cols-2 gap-2">
			<button type="button" class="btn-primary" onclick={addToDraft}
				>{translate(lang, 'exercise.toDraft')}</button
			>
			<a class="btn-secondary" href="/builder">{translate(lang, 'exercise.builder')}</a>
		</div>
	</div>
{/if}
