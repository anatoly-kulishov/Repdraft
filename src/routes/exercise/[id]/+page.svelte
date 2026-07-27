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
	<article class="grid gap-6 lg:grid-cols-[280px_1fr]">
		<div>
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
				<h1 class="font-[family-name:var(--font-display)] text-3xl text-[var(--color-ink)]">
					{exercise.name}
				</h1>
			</div>

			<dl class="grid gap-2 text-sm sm:grid-cols-2">
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

			<div class="flex flex-wrap gap-2">
				<button type="button" class="btn-primary" onclick={addToDraft}>Добавить в черновик</button>
				<a class="btn-secondary" href="/builder">Открыть конструктор</a>
			</div>

			<PersonalRecordPanel exerciseId={exercise.id} />

			<section>
				<h2 class="mb-2 font-[family-name:var(--font-display)] text-xl">Как выполнять</h2>
				<ol class="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-[var(--color-ink)]">
					{#each exercise.instruction_steps.ru ?? [] as step, i (i)}
						<li>{step}</li>
					{/each}
				</ol>
			</section>
		</div>
	</article>
{/if}
