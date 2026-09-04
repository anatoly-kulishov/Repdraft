<script lang="ts">
	import AppTextarea from '$lib/components/AppTextarea.svelte';
	import AppButton from '$lib/components/AppButton.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import AppLabel from '$lib/components/AppLabel.svelte';
	import AppPanel from '$lib/components/AppPanel.svelte';
	import {
		coerceReps,
		coerceWeightKg,
		filterRepsInput,
		filterWeightInput,
		NOTE_MAX,
		REPS,
		REPS_INPUT_MAX_LEN,
		WEIGHT_INPUT_MAX_LEN,
		WEIGHT_KG
	} from '$lib/domain/inputLimits';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import RecordsNoteChip from '$lib/components/RecordsNoteChip.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import Spinner from '$lib/components/Spinner.svelte';
	import {
		createEmptyRecord,
		formatPersonalRecord,
		hasLiftData,
		isRecordEmpty,
		personalRecordContentEqual,
		sanitizePersonalRecord
	} from '$lib/domain/records';
	import type { PersonalRecord } from '$lib/domain/types';
	import { isCardioBodyPart } from '$lib/domain/workout';
	import { cn } from '$lib/utils.js';
	import { translate } from '$lib/i18n/messages';
	import { records, recordsReady } from '$lib/stores/records';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';
	import { X } from '@lucide/svelte';
	import { tick } from 'svelte';

	let {
		exerciseId,
		bodyPart = null as string | null,
		embedded = false
	}: {
		exerciseId: string;
		bodyPart?: string | null;
		embedded?: boolean;
	} = $props();

	let form = $state<PersonalRecord>(createEmptyRecord(''));
	let hasSaved = $state(false);
	let hasStoredEntry = $state(false);
	let weightText = $state('');
	let repsText = $state('');
	let noteText = $state('');
	let busy = $state(false);
	let lang = $derived($resolvedLocale);
	let noteOnly = $derived(isCardioBodyPart(bodyPart));
	/** Avoid re-applying store → inputs when $records refreshes with the same row. */
	let syncedKey = '';
	let boundId = '';
	/** User edited fields - don't clobber with late store hydration / cloud refresh. */
	let dirty = $state(false);
	let invalidWeight = $state(false);
	let invalidReps = $state(false);
	let notePreviewOpen = $state(false);

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
			notePreviewOpen = false;
		}
		const existing = records.get(id);
		const next = existing ? { ...existing } : createEmptyRecord(id);
		const note = next.note.slice(0, NOTE_MAX);
		const key = existing
			? `${id}:${existing.updatedAt}:${existing.weightKg}:${existing.reps}:${existing.note}`
			: `${id}:empty`;
		hasStoredEntry = existing != null;
		hasSaved = existing != null && (noteOnly ? !isRecordEmpty(existing) : hasLiftData(existing));
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
		let weightKg = noteOnly ? null : weightText.trim() ? coerceWeightKg(weightText) : null;
		let reps = noteOnly ? null : repsText.trim() ? coerceReps(repsText, REPS) : null;
		if (!noteOnly && weightText.trim() && weightKg == null) {
			weightText = '';
			weightKg = null;
		}
		if (!noteOnly && repsText.trim() && reps == null) {
			repsText = '';
			reps = null;
		}

		const sanitizeOpts = noteOnly ? { allowNoteOnly: true } : undefined;
		const result = sanitizePersonalRecord(
			{
				exerciseId,
				weightKg,
				reps,
				note: noteText,
				updatedAt: new Date().toISOString()
			},
			sanitizeOpts
		);
		if (!result.ok) {
			toasts.show(
				translate(lang, result.errorKey),
				result.errorKey === 'pr.needValue' ||
					result.errorKey === 'pr.needLift' ||
					result.errorKey === 'pr.needNote'
					? 'info'
					: 'error'
			);
			if (result.errorKey === 'pr.invalidWeight') void flashFields(true, false);
			else if (result.errorKey === 'pr.invalidReps') void flashFields(false, true);
			else if (result.errorKey !== 'pr.needLift' && result.errorKey !== 'pr.needNote') {
				void flashFields(true, true);
			}
			return;
		}

		const existing = records.get(exerciseId);
		if (existing && personalRecordContentEqual(existing, result.record)) {
			dirty = false;
			return;
		}

		busy = true;
		try {
			await records.save(result.record, sanitizeOpts);
			const saved = result.record;
			dirty = false;
			syncedKey = `${exerciseId}:${saved.updatedAt}:${saved.weightKg}:${saved.reps}:${saved.note}`;
			form = { ...saved };
			weightText = saved.weightKg != null ? String(saved.weightKg) : '';
			repsText = saved.reps != null ? String(saved.reps) : '';
			noteText = saved.note;
			hasStoredEntry = true;
			hasSaved = noteOnly ? !isRecordEmpty(saved) : hasLiftData(saved);
			toasts.show(translate(lang, 'pr.saved'), 'success');
		} catch (err) {
			toasts.show(err instanceof Error ? err.message : translate(lang, 'pr.saveFail'), 'error');
		} finally {
			busy = false;
		}
	}

	async function onClear() {
		if (busy) return;
		if (!hasStoredEntry) {
			form = createEmptyRecord(exerciseId);
			weightText = '';
			repsText = '';
			noteText = '';
			dirty = false;
			syncedKey = `${exerciseId}:empty`;
			return;
		}
		const snapshot = records.get(exerciseId);
		if (!snapshot) return;
		busy = true;
		try {
			await records.remove(exerciseId);
			form = createEmptyRecord(exerciseId);
			weightText = '';
			repsText = '';
			noteText = '';
			hasStoredEntry = false;
			hasSaved = false;
			dirty = false;
			syncedKey = `${exerciseId}:empty`;
			toasts.showUndo(translate(lang, 'pr.deleted'), async () => {
				await records.save(snapshot, noteOnly ? { allowNoteOnly: true } : undefined);
			}, 'info');
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

	function buildDraftRecord(): PersonalRecord | null {
		let weightKg = noteOnly ? null : weightText.trim() ? coerceWeightKg(weightText) : null;
		let reps = noteOnly ? null : repsText.trim() ? coerceReps(repsText, REPS) : null;
		if (!noteOnly && weightText.trim() && weightKg == null) weightKg = null;
		if (!noteOnly && repsText.trim() && reps == null) reps = null;
		const result = sanitizePersonalRecord(
			{
				exerciseId,
				weightKg,
				reps,
				note: noteText,
				updatedAt: form.updatedAt || new Date().toISOString()
			},
			noteOnly ? { allowNoteOnly: true } : undefined
		);
		return result.ok ? result.record : null;
	}

	let saveDisabled = $derived.by(() => {
		if (busy) return true;
		if (!hasStoredEntry) return !dirty;
		$records;
		const existing = records.get(exerciseId);
		if (!existing) return !dirty;
		const draft = buildDraftRecord();
		if (!draft) return false;
		return personalRecordContentEqual(existing, draft);
	});

	/** Empty draft with nothing stored: Reset does nothing useful. */
	let clearDisabled = $derived(
		busy ||
			(!hasStoredEntry &&
				!weightText.trim() &&
				!repsText.trim() &&
				!noteText.trim())
	);

	let savedNotePreview = $derived(noteText.trim());
	let previewValue = $derived.by(() => {
		if (!noteOnly) {
			return formatPersonalRecord(
				{
					...form,
					weightKg: weightText.trim() ? coerceWeightKg(weightText) : null,
					reps: repsText.trim() ? coerceReps(repsText, REPS) : null,
					note: ''
				},
				lang
			);
		}
		if (savedNotePreview) return savedNotePreview;
		// Legacy cardio rows that still have weight×reps from before note-only.
		return formatPersonalRecord(
			{
				...form,
				weightKg: weightText.trim() ? coerceWeightKg(weightText) : null,
				reps: repsText.trim() ? coerceReps(repsText, REPS) : null,
				note: ''
			},
			lang
		);
	});
</script>

<AppPanel class={embedded ? 'pr-panel--embedded' : undefined}>
	{#if !embedded}
		<div class="pr-panel-head">
			<h2 class="section-title">{translate(lang, 'pr.title')}</h2>
		</div>
	{/if}

	{#if noteOnly}
		<p class="pr-cardio-hint text-sm text-[var(--color-muted)]">
			{translate(lang, 'pr.cardioHint')}
		</p>
	{/if}

	{#if hasSaved && previewValue}
		<div class="pr-now-preview">
			<p class="pr-now-chip" title={previewValue}>
				<span class="pr-now-chip__text">{translate(lang, 'pr.now', { value: previewValue })}</span>
			</p>
			{#if !noteOnly && savedNotePreview}
				<RecordsNoteChip
					text={savedNotePreview}
					{lang}
					open={notePreviewOpen}
					measureRootSelector=".pr-now-preview"
					onToggle={() => (notePreviewOpen = !notePreviewOpen)}
				/>
			{/if}
		</div>
	{/if}

	<div class="grid min-w-0 grid-cols-2 gap-3">
		{#if !noteOnly}
			<AppLabel class="min-w-0">
				{translate(lang, 'pr.weight')}
				<span class="field-shell mt-1">
					<AppInput
						class={invalidWeight ? 'is-invalid' : undefined}
						aria-invalid={invalidWeight}
						type="text"
						inputmode="decimal"
						autocomplete="off"
						placeholder="-"
						maxlength={WEIGHT_INPUT_MAX_LEN}
						aria-describedby="pr-weight-hint"
						value={weightText}
						oninput={onWeightInput}
					/>
				</span>
				<span id="pr-weight-hint" class="mt-1 block text-[11px] text-[var(--color-muted)]">
					{WEIGHT_KG.min}-{WEIGHT_KG.max}
				</span>
			</AppLabel>
			<AppLabel class="min-w-0">
				{translate(lang, 'pr.reps')}
				<span class="field-shell mt-1">
					<AppInput
						class={invalidReps ? 'is-invalid' : undefined}
						aria-invalid={invalidReps}
						type="text"
						inputmode="numeric"
						autocomplete="off"
						placeholder="-"
						maxlength={REPS_INPUT_MAX_LEN}
						aria-describedby="pr-reps-hint"
						value={repsText}
						oninput={onRepsInput}
					/>
				</span>
				<span id="pr-reps-hint" class="mt-1 block text-[11px] text-[var(--color-muted)]">
					{REPS.min}-{REPS.max}
				</span>
			</AppLabel>
		{/if}
		<AppLabel class="pr-note-block col-span-2 min-w-0">
			{translate(lang, 'pr.note')}
			<span class="field-shell pr-note-shell mt-1">
				<AppTextarea
					class={cn('pr-note-field', noteText.length > 0 && 'pr-note-field--has-clear')}
					rows={1}
					maxlength={NOTE_MAX}
					placeholder={translate(lang, noteOnly ? 'pr.notePhCardio' : 'pr.notePh')}
					aria-describedby="pr-note-count"
					bind:value={noteText}
					oninput={onNoteInput}
				/>
				{#if noteText.length > 0}
					<button
						type="button"
						class="pr-note-clear"
						aria-label={translate(lang, 'a11y.clearField')}
						title={translate(lang, 'a11y.clearField')}
						onclick={clearNote}
					>
						<LucideIcon icon={X} size={ICON_SMALL} />
					</button>
				{/if}
			</span>
			<span
				id="pr-note-count"
				class="pr-note-count"
				class:pr-note-count--limit={noteText.length >= NOTE_MAX}
				aria-live="polite"
			>
				{noteText.length}/{NOTE_MAX}
			</span>
		</AppLabel>
	</div>

	<div class="pr-actions">
		<AppButton
			variant="secondary"
			class="pr-actions__btn"
			disabled={clearDisabled}
			onclick={() => void onClear()}
		>
			{hasStoredEntry ? translate(lang, 'pr.delete') : translate(lang, 'pr.clear')}
		</AppButton>
		<AppButton class="pr-actions__btn" disabled={saveDisabled} aria-busy={busy} onclick={() => void onSave()}>
			{#if busy}
				<span class="inline-flex items-center justify-center gap-2">
					<Spinner size="sm" block={false} />
					{translate(lang, 'auth.wait')}
				</span>
			{:else}
				{translate(lang, 'pr.save')}
			{/if}
		</AppButton>
	</div>
</AppPanel>
