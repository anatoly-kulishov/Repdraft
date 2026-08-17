<script lang="ts">
	import {
		coerceReps,
		coerceWeightKg,
		filterRepsInput,
		filterWeightInput,
		NOTE_MAX,
		REPS,
		WEIGHT_KG
	} from '$lib/domain/inputLimits';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import Spinner from '$lib/components/Spinner.svelte';
	import { createEmptyRecord, formatPersonalRecord, sanitizePersonalRecord } from '$lib/domain/records';
	import type { PersonalRecord } from '$lib/domain/types';
	import { translate } from '$lib/i18n/messages';
	import { records, recordsReady } from '$lib/stores/records';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';
	import { ChevronDown } from '@lucide/svelte';
	import { tick } from 'svelte';

	let { exerciseId }: { exerciseId: string } = $props();

	let form = $state<PersonalRecord>(createEmptyRecord(''));
	let hasSaved = $state(false);
	let weightText = $state('');
	let repsText = $state('');
	let noteText = $state('');
	let busy = $state(false);
	let lang = $derived($resolvedLocale);
	/** Avoid re-applying store → inputs when $records refreshes with the same row. */
	let syncedKey = '';
	let boundId = '';
	/** User edited fields - don't clobber with late store hydration / cloud refresh. */
	let dirty = false;
	let invalidWeight = $state(false);
	let invalidReps = $state(false);
	let previewOpen = $state(false);

	function markDirty() {
		dirty = true;
		invalidWeight = false;
		invalidReps = false;
	}

	async function flashFields(weight: boolean, reps: boolean) {
		invalidWeight = false;
		invalidReps = false;
		await tick();
		invalidWeight = weight;
		invalidReps = reps;
	}

	function onWeightInput(event: Event) {
		const el = event.currentTarget as HTMLInputElement;
		const next = filterWeightInput(el.value, weightText);
		weightText = next;
		if (el.value !== next) el.value = next;
		markDirty();
	}

	function onRepsInput(event: Event) {
		const el = event.currentTarget as HTMLInputElement;
		const next = filterRepsInput(el.value, REPS, repsText);
		repsText = next;
		if (el.value !== next) el.value = next;
		markDirty();
	}

	function onNoteInput(event: Event) {
		const el = event.currentTarget as HTMLTextAreaElement;
		const next = el.value.slice(0, NOTE_MAX);
		noteText = next;
		if (el.value !== next) el.value = next;
		markDirty();
	}

	$effect(() => {
		const id = exerciseId;
		$records;
		if (!$recordsReady) return;
		if (id !== boundId) {
			boundId = id;
			dirty = false;
			syncedKey = '';
			previewOpen = false;
		}
		const existing = records.get(id);
		const next = existing ? { ...existing } : createEmptyRecord(id);
		const note = next.note.slice(0, NOTE_MAX);
		const key = existing
			? `${id}:${existing.updatedAt}:${existing.weightKg}:${existing.reps}:${existing.note}`
			: `${id}:empty`;
		hasSaved = existing != null;
		if (dirty) return;
		if (key === syncedKey) return;
		syncedKey = key;
		// Assign from `next` only - never read `form` here (self-invalidates the effect).
		form = { ...next, note };
		weightText = next.weightKg != null ? String(next.weightKg) : '';
		repsText = next.reps != null ? String(next.reps) : '';
		noteText = note;
	});

	async function onSave() {
		if (busy) return;
		// Filters keep fields in-range; treat incomplete crumbs as empty.
		let weightKg = weightText.trim() ? coerceWeightKg(weightText) : null;
		let reps = repsText.trim() ? coerceReps(repsText, REPS) : null;
		if (weightText.trim() && weightKg == null) {
			weightText = '';
			weightKg = null;
		}
		if (repsText.trim() && reps == null) {
			repsText = '';
			reps = null;
		}

		const result = sanitizePersonalRecord({
			exerciseId,
			weightKg,
			reps,
			note: noteText,
			updatedAt: new Date().toISOString()
		});
		if (!result.ok) {
			toasts.show(translate(lang, result.errorKey), result.errorKey === 'pr.needValue' ? 'info' : 'error');
			if (result.errorKey === 'pr.invalidWeight') void flashFields(true, false);
			else if (result.errorKey === 'pr.invalidReps') void flashFields(false, true);
			else void flashFields(true, true);
			return;
		}

		busy = true;
		try {
			await records.save(result.record);
			const saved = result.record;
			dirty = false;
			syncedKey = `${exerciseId}:${saved.updatedAt}:${saved.weightKg}:${saved.reps}:${saved.note}`;
			form = { ...saved };
			weightText = saved.weightKg != null ? String(saved.weightKg) : '';
			repsText = saved.reps != null ? String(saved.reps) : '';
			noteText = saved.note;
			hasSaved = true;
			toasts.show(translate(lang, 'pr.saved'), 'success');
		} catch (err) {
			toasts.show(err instanceof Error ? err.message : translate(lang, 'pr.saveFail'), 'error');
		} finally {
			busy = false;
		}
	}

	async function onClear() {
		if (busy) return;
		if (!hasSaved) {
			form = createEmptyRecord(exerciseId);
			weightText = '';
			repsText = '';
			noteText = '';
			dirty = false;
			syncedKey = `${exerciseId}:empty`;
			return;
		}
		if (!confirm(translate(lang, 'pr.confirmDelete'))) return;
		busy = true;
		try {
			await records.remove(exerciseId);
			form = createEmptyRecord(exerciseId);
			weightText = '';
			repsText = '';
			noteText = '';
			hasSaved = false;
			dirty = false;
			syncedKey = `${exerciseId}:empty`;
			toasts.show(translate(lang, 'pr.deleted'), 'info');
		} catch (err) {
			toasts.show(err instanceof Error ? err.message : translate(lang, 'pr.deleteFail'), 'error');
		} finally {
			busy = false;
		}
	}

	function clearNote() {
		noteText = '';
		markDirty();
	}

	let preview = $derived(
		formatPersonalRecord(
			{
				...form,
				weightKg: weightText.trim() ? coerceWeightKg(weightText) : null,
				reps: repsText.trim() ? coerceReps(repsText, REPS) : null,
				note: noteText
			},
			lang
		)
	);
	let canExpandPreview = $derived(noteText.trim().length > 0);
</script>

<section class="panel">
	<div class="mb-3 flex min-w-0 flex-wrap items-baseline justify-between gap-2">
		<h2 class="section-title">{translate(lang, 'pr.title')}</h2>
		<p class="shrink-0 text-xs text-[var(--color-muted)]">{translate(lang, 'pr.hint')}</p>
	</div>

	{#if hasSaved && preview}
		{#if canExpandPreview}
			<button
				type="button"
				class="pr-now-chip is-button"
				class:is-open={previewOpen}
				aria-expanded={previewOpen}
				title={translate(lang, previewOpen ? 'pr.nowCollapse' : 'pr.nowExpand')}
				onclick={() => (previewOpen = !previewOpen)}
			>
				<span class="pr-now-chip__text">{translate(lang, 'pr.now', { value: preview })}</span>
				<span class="pr-now-chip__chevron" aria-hidden="true">
					<LucideIcon icon={ChevronDown} size={ICON_SMALL} />
				</span>
			</button>
		{:else}
			<p class="pr-now-chip" title={preview}>
				<span class="pr-now-chip__text">{translate(lang, 'pr.now', { value: preview })}</span>
			</p>
		{/if}
	{/if}

	<div class="grid min-w-0 grid-cols-2 gap-3">
		<label class="field-label min-w-0">
			{translate(lang, 'pr.weight')}
			<span class="field-shell mt-1">
				<input
					class="field"
					class:is-invalid={invalidWeight}
					aria-invalid={invalidWeight}
					type="text"
					inputmode="decimal"
					autocomplete="off"
					placeholder="—"
					aria-describedby="pr-weight-hint"
					value={weightText}
					oninput={onWeightInput}
				/>
			</span>
			<span id="pr-weight-hint" class="mt-1 block text-[11px] text-[var(--color-muted)]">
				{WEIGHT_KG.min}-{WEIGHT_KG.max}
			</span>
		</label>
		<label class="field-label min-w-0">
			{translate(lang, 'pr.reps')}
			<span class="field-shell mt-1">
				<input
					class="field"
					class:is-invalid={invalidReps}
					aria-invalid={invalidReps}
					type="text"
					inputmode="numeric"
					autocomplete="off"
					placeholder="—"
					aria-describedby="pr-reps-hint"
					value={repsText}
					oninput={onRepsInput}
				/>
			</span>
			<span id="pr-reps-hint" class="mt-1 block text-[11px] text-[var(--color-muted)]">
				{REPS.min}-{REPS.max}
			</span>
		</label>
		<label class="field-label col-span-2 min-w-0">
			<span class="flex items-center justify-between gap-2">
				{translate(lang, 'pr.note')}
				{#if noteText.length > 0}
					<button
						type="button"
						class="text-[11px] font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)]"
						onclick={clearNote}
					>
						{translate(lang, 'a11y.clearField')}
					</button>
				{/if}
			</span>
			<span class="field-shell mt-1">
				<textarea
					class="field pr-note-field"
					rows="3"
					maxlength={NOTE_MAX}
					placeholder={translate(lang, 'pr.notePh')}
					value={noteText}
					oninput={onNoteInput}
				></textarea>
			</span>
			<span
				class="mt-1 block text-right text-[11px]"
				class:text-[var(--color-muted)]={noteText.length < NOTE_MAX}
				class:text-[var(--color-danger)]={noteText.length >= NOTE_MAX}
			>
				{noteText.length}/{NOTE_MAX}
			</span>
		</label>
	</div>

	<div class="mt-3 flex flex-wrap items-center gap-2">
		<button type="button" class="btn-primary" disabled={busy} aria-busy={busy} onclick={() => void onSave()}>
			{#if busy}
				<span class="inline-flex items-center gap-2">
					<Spinner size="sm" block={false} />
					{translate(lang, 'auth.wait')}
				</span>
			{:else}
				{translate(lang, 'pr.save')}
			{/if}
		</button>
		<button type="button" class="btn-link text-sm" disabled={busy} onclick={() => void onClear()}>
			{hasSaved ? translate(lang, 'pr.delete') : translate(lang, 'pr.clear')}
		</button>
	</div>
</section>
