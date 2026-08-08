<script lang="ts">
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { auth } from '$lib/stores/auth';
	import { plans } from '$lib/stores/plans';
	import { toasts } from '$lib/stores/toasts';
	import { onMount } from 'svelte';

	onMount(() => {
		void plans.refresh();
	});

	function formatDate(iso: string): string {
		try {
			return new Intl.DateTimeFormat('ru-RU', {
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
			if (copy) toasts.show('План скопирован', 'success');
		} catch (err) {
			toasts.show(err instanceof Error ? err.message : 'Ошибка', 'error');
		}
	}

	async function onRemove(id: string, name: string) {
		if (!confirm(`Удалить «${name}»?`)) return;
		try {
			await plans.removePlan(id);
			toasts.show('План удалён', 'info');
		} catch (err) {
			toasts.show(err instanceof Error ? err.message : 'Ошибка', 'error');
		}
	}
</script>

<svelte:head>
	<title>Мои тренировки — Repdraft</title>
</svelte:head>

<section>
	<div class="mb-4">
		<h1 class="font-[family-name:var(--font-display)] text-2xl md:text-3xl">Мои тренировки</h1>
		<p class="mt-1 text-sm text-[var(--color-muted)]">
			{#if $auth.user}
				Планы в облаке — доступны с телефона и компьютера.
			{:else}
				Пока локально на устройстве.
				<a class="text-[var(--color-accent)] underline" href="/auth">Войдите</a>, чтобы синхронизировать.
			{/if}
		</p>
	</div>

	{#if $plans.length === 0}
		<EmptyState
			title="Пока нет сохранённых тренировок"
			description="Соберите черновик в конструкторе и нажмите «Сохранить»."
			actionHref="/builder"
			actionLabel="Открыть конструктор"
		/>
	{:else}
		<ul class="flex flex-col gap-3">
			{#each $plans as plan (plan.id)}
				<li
					class="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:flex-row sm:items-center sm:justify-between"
				>
					<div>
						<h2 class="text-lg font-semibold">{plan.name}</h2>
						<p class="text-sm text-[var(--color-muted)]">
							{plan.exercises.length} упр. · {formatDate(plan.updatedAt)}
						</p>
					</div>
					<div class="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
						<a class="btn-primary col-span-2 sm:col-span-1" href={`/builder/${plan.id}`}>Открыть</a>
						<button type="button" class="btn-secondary" onclick={() => void onDuplicate(plan.id)}>
							Дублировать
						</button>
						<button
							type="button"
							class="btn-ghost px-3 text-red-700"
							onclick={() => void onRemove(plan.id, plan.name)}
						>
							Удалить
						</button>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>
