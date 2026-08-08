<script lang="ts">
	import { createEmptyRecord, formatPersonalRecord, isRecordEmpty } from '$lib/domain/records';
	import type { PersonalRecord } from '$lib/domain/types';
	import { records } from '$lib/stores/records';
	import { toasts } from '$lib/stores/toasts';

	let { exerciseId }: { exerciseId: string } = $props();

	let form = $state<PersonalRecord>(createEmptyRecord(''));
	let hasSaved = $state(false);

	$effect(() => {
		$records;
		const existing = records.get(exerciseId);
		hasSaved = existing != null;
		form = existing ? { ...existing } : createEmptyRecord(exerciseId);
	});

	function parseOptionalNumber(raw: string): number | null {
		const trimmed = raw.trim();
		if (!trimmed) return null;
		const value = Number(trimmed.replace(',', '.'));
		return Number.isFinite(value) ? value : null;
	}

	async function onSave() {
		const next: PersonalRecord = {
			exerciseId,
			weightKg: form.weightKg,
			reps: form.reps,
			note: form.note.trim(),
			updatedAt: new Date().toISOString()
		};
		if (isRecordEmpty(next)) {
			toasts.show('Укажите вес, повторы или заметку', 'info');
			return;
		}
		try {
			await records.save(next);
			hasSaved = true;
			toasts.show('Рекорд сохранён', 'success');
		} catch (err) {
			toasts.show(err instanceof Error ? err.message : 'Не удалось сохранить', 'error');
		}
	}

	async function onClear() {
		if (!hasSaved) {
			form = createEmptyRecord(exerciseId);
			return;
		}
		if (!confirm('Удалить личный рекорд для этого упражнения?')) return;
		try {
			await records.remove(exerciseId);
			form = createEmptyRecord(exerciseId);
			hasSaved = false;
			toasts.show('Рекорд удалён', 'info');
		} catch (err) {
			toasts.show(err instanceof Error ? err.message : 'Не удалось удалить', 'error');
		}
	}

	let preview = $derived(formatPersonalRecord(form));
</script>

<section class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
	<div class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
		<h2 class="font-[family-name:var(--font-display)] text-xl">Личный рекорд</h2>
		<p class="text-xs text-[var(--color-muted)]">По желанию — синхронизируется при входе в аккаунт</p>
	</div>

	{#if hasSaved && preview}
		<p class="mb-3 rounded-lg bg-[color-mix(in_srgb,var(--color-accent)_12%,white)] px-3 py-2 text-sm font-semibold text-[var(--color-accent)]">
			Сейчас: {preview}
		</p>
	{/if}

	<div class="grid gap-3 sm:grid-cols-3">
		<label class="text-xs font-medium text-[var(--color-muted)]">
			Вес, кг
			<input
				class="field mt-1 w-full"
				type="number"
				min="0"
				step="0.5"
				placeholder="—"
				value={form.weightKg ?? ''}
				oninput={(e) => {
					form.weightKg = parseOptionalNumber((e.currentTarget as HTMLInputElement).value);
				}}
			/>
		</label>
		<label class="text-xs font-medium text-[var(--color-muted)]">
			Повторы
			<input
				class="field mt-1 w-full"
				type="number"
				min="1"
				max="500"
				step="1"
				placeholder="—"
				value={form.reps ?? ''}
				oninput={(e) => {
					const raw = (e.currentTarget as HTMLInputElement).value.trim();
					if (!raw) {
						form.reps = null;
						return;
					}
					const n = Math.round(Number(raw));
					form.reps = Number.isFinite(n) ? Math.min(500, Math.max(1, n)) : null;
				}}
			/>
		</label>
		<label class="text-xs font-medium text-[var(--color-muted)] sm:col-span-1">
			Заметка
			<input
				class="field mt-1 w-full"
				type="text"
				maxlength="120"
				placeholder="например: пауза 2 сек"
				bind:value={form.note}
			/>
		</label>
	</div>

	<div class="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
		<button type="button" class="btn-primary" onclick={onSave}>Сохранить</button>
		<button type="button" class="btn-secondary" onclick={onClear}>
			{hasSaved ? 'Удалить' : 'Сбросить'}
		</button>
	</div>
</section>
