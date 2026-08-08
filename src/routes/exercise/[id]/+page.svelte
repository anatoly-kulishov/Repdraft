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
	import { draft } from '$lib/stores/draft';
	import { toasts } from '$lib/stores/toasts';
	import PersonalRecordPanel from '$lib/components/PersonalRecordPanel.svelte';
	import TechniqueClipsPanel from '$lib/components/TechniqueClipsPanel.svelte';

	let exercise = $state<Exercise | null>(null);
	let loading = $state(true);
	let notFound = $state(false);

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
			toasts.show('Добавлено в черновик', 'success');
		} else {
			toasts.show('Уже в черновике', 'info');
		}
	}
</script>

<svelte:head>
	<title>{exercise ? `${exercise.name} — Repdraft` : 'Упражнение — Repdraft'}</title>
</svelte:head>

{#if loading}
	<p class="text-sm text-[var(--color-muted)]">Загрузка…</p>
{:else if notFound || !exercise}
	<EmptyState
		title="Упражнение не найдено"
		description="Проверьте ссылку или вернитесь в каталог."
		actionHref="/"
		actionLabel="К каталогу"
	/>
{:else}
	<article class="grid gap-5 pb-24 lg:grid-cols-[280px_1fr] lg:gap-6 lg:pb-0">
		<div>
			<a href="/" class="mb-3 inline-flex text-sm font-medium text-[var(--color-accent)] md:hidden">← Каталог</a>
			<div class="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
				<img
					src={`/${exercise.gif_url}`}
					alt={exercise.name}
					width="180"
					height="180"
					class="mx-auto h-[180px] w-[180px] object-contain"
				/>
			</div>
			<p class="mt-2 text-xs text-[var(--color-muted)]">{exercise.attribution}</p>
		</div>

		<div class="flex flex-col gap-4">
			<div>
				<p class="text-sm text-[var(--color-muted)]">{labelBodyPart(exercise.body_part)}</p>
				<h1 class="font-[family-name:var(--font-display)] text-2xl leading-tight text-[var(--color-ink)] sm:text-3xl">
					{exercise.name}
				</h1>
			</div>

			<dl class="grid gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm sm:grid-cols-2">
				<div>
					<dt class="text-[var(--color-muted)]">Оборудование</dt>
					<dd class="font-medium">{labelEquipment(exercise.equipment)}</dd>
				</div>
				<div>
					<dt class="text-[var(--color-muted)]">Целевая мышца</dt>
					<dd class="font-medium">{labelTarget(exercise.target)}</dd>
				</div>
				<div class="sm:col-span-2">
					<dt class="text-[var(--color-muted)]">Дополнительно</dt>
					<dd class="font-medium">
						{#if exercise.secondary_muscles.length}
							{exercise.secondary_muscles.map(labelTarget).join(', ')}
						{:else}
							—
						{/if}
					</dd>
				</div>
			</dl>

			<div class="hidden flex-wrap gap-2 md:flex">
				<button type="button" class="btn-primary" onclick={addToDraft}>Добавить в черновик</button>
				<a class="btn-secondary" href="/builder">Открыть конструктор</a>
			</div>

			<PersonalRecordPanel exerciseId={exercise.id} />

			<TechniqueClipsPanel exerciseId={exercise.id} />

			<section>
				<h2 class="mb-2 font-[family-name:var(--font-display)] text-xl">Как выполнять</h2>
				<ol class="list-decimal space-y-2.5 pl-5 text-sm leading-relaxed text-[var(--color-ink)]">
					{#each exercise.instruction_steps.ru ?? [] as step, i (i)}
						<li>{step}</li>
					{/each}
				</ol>
			</section>
		</div>
	</article>

	<div class="sticky-actions md:hidden">
		<div class="mx-auto grid max-w-6xl grid-cols-2 gap-2">
			<button type="button" class="btn-primary" onclick={addToDraft}>В черновик</button>
			<a class="btn-secondary" href="/builder">Конструктор</a>
		</div>
	</div>
{/if}
