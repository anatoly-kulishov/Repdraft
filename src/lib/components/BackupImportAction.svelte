<script lang="ts">
	import {
		parseExportJson,
		type RepdraftExportPayload
	} from '$lib/domain/exportData';
	import {
		detectCsvFormat,
		normalizeExerciseName,
		parseCsvImport,
		splitCsvRows,
		suggestCatalogCandidates,
		type CsvImportReport
	} from '$lib/domain/importCsv';
	import type { ExerciseIndexItem } from '$lib/domain/types';
	import { loadExerciseIndexWithCustoms } from '$lib/data/exerciseIndexWithCustoms';
	import { translate, translateError } from '$lib/i18n/messages';
	import { applyLocalBackupImport } from '$lib/storage/applyLocalBackupImport';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';
	import AppButton from '$lib/components/AppButton.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	let {
		variant = 'secondary',
		block = false,
		class: className = ''
	}: {
		variant?: 'primary' | 'secondary' | 'link';
		block?: boolean;
		class?: string;
	} = $props();

	let lang = $derived($resolvedLocale);
	let busy = $state(false);
	let fileInput: HTMLInputElement | undefined = $state();
	let pendingPayload = $state<RepdraftExportPayload | null>(null);
	let importOfferOpen = $state(false);
	let csvReport = $state<CsvImportReport | null>(null);
	/** Raw CSV kept so manual mapping re-parses without re-picking the file. */
	let rawCsv = $state<string | null>(null);
	let catalog = $state<readonly ExerciseIndexItem[]>([]);
	/** Names that arrived unmatched — the review list stays stable while mapping. */
	let reviewNames = $state<string[]>([]);
	let overrides = $state<Record<string, string>>({});
	let unit = $state<'kg' | 'lb'>('kg');

	let showUnitToggle = $derived(
		csvReport?.format === 'strong' || csvReport?.format === 'generic'
	);

	let reviewRows = $derived(
		reviewNames.map((name) => {
			const key = normalizeExerciseName(name);
			return {
				key,
				name,
				value: overrides[key] ?? '',
				candidates: suggestCatalogCandidates(name, catalog, 5)
			};
		})
	);

	function parseCsv(text: string, nextOverrides: Record<string, string>) {
		return parseCsvImport(text, { catalog, overrides: nextOverrides, weightScale: unit });
	}

	function applyCsvPreview(text: string, nextOverrides: Record<string, string>) {
		const csv = parseCsv(text, nextOverrides);
		if (!csv.ok) {
			toasts.show(translate(lang, 'settings.importCsvEmpty'), 'error');
			return;
		}
		pendingPayload = csv.payload;
		csvReport = csv.report;
	}

	function onUnitChange(next: 'kg' | 'lb') {
		unit = next;
		if (rawCsv) applyCsvPreview(rawCsv, overrides);
	}

	function onOverrideChange(key: string, value: string) {
		overrides = { ...overrides, [key]: value };
		if (rawCsv) applyCsvPreview(rawCsv, overrides);
	}

	function openImportPicker() {
		if (busy) return;
		fileInput?.click();
	}

	async function onImportFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file || busy) return;

		try {
			const text = await file.text();
			const parsed = parseExportJson(text);
			if (parsed.ok) {
				pendingPayload = parsed.payload;
				csvReport = null;
				importOfferOpen = true;
				return;
			}

			/* CSV from another app (Strong is sunset; Hevy is the other big history dump). */
			const rows = splitCsvRows(text);
			if (detectCsvFormat(rows[0])) {
				catalog = await loadExerciseIndexWithCustoms();
				overrides = {};
				rawCsv = text;
				const csv = parseCsv(text, {});
				if (!csv.ok) {
					toasts.show(translate(lang, 'settings.importCsvEmpty'), 'error');
					return;
				}
				reviewNames = [...csv.report.customExercises];
				applyCsvPreview(text, {});
				importOfferOpen = true;
				return;
			}

			const key =
				parsed.reason === 'invalidJson'
					? 'settings.importInvalidJson'
					: parsed.reason === 'unsupportedVersion'
						? 'settings.importUnsupported'
						: 'settings.importInvalidShape';
			toasts.show(translate(lang, key), 'error');
		} catch (err) {
			toasts.show(translateError(lang, err, 'settings.importFail'), 'error');
		}
	}

	function dismissImportOffer() {
		if (busy) return;
		importOfferOpen = false;
		pendingPayload = null;
		csvReport = null;
		rawCsv = null;
		reviewNames = [];
		overrides = {};
	}

	async function commitImport() {
		if (!pendingPayload || busy) return;
		busy = true;
		const payload = pendingPayload;
		// Let the confirm-button spinner paint before heavy sync work.
		await new Promise<void>((resolve) =>
			requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
		);
		try {
			const { cloudSynced, useCloud } = await applyLocalBackupImport(payload);
			if (useCloud && !cloudSynced) {
				toasts.show(translate(lang, 'settings.importCloudPending'), 'info');
			} else {
				toasts.show(translate(lang, 'settings.importDone'), 'success');
			}
			importOfferOpen = false;
			pendingPayload = null;
			csvReport = null;
			rawCsv = null;
			reviewNames = [];
			overrides = {};
		} catch (err) {
			toasts.show(translateError(lang, err, 'settings.importFail'), 'error');
		} finally {
			busy = false;
		}
	}
</script>

<AppButton
	variant={variant === 'link' ? 'link' : variant === 'secondary' ? 'secondary' : undefined}
	{block}
	class={className}
	disabled={busy}
	onclick={openImportPicker}
>
	{#if busy}
		<span class="inline-flex items-center justify-center gap-2">
			<Spinner size="sm" block={false} />
			{translate(lang, 'auth.wait')}
		</span>
	{:else}
		{translate(lang, 'settings.importJson')}
	{/if}
</AppButton>
<input
	bind:this={fileInput}
	type="file"
	accept="application/json,.json,text/csv,.csv"
	class="sr-only"
	tabindex="-1"
	onchange={(e) => void onImportFile(e)}
/>

{#if importOfferOpen}
	<BottomSheet
		open={importOfferOpen}
		titleId="backup-import-offer-title"
		dismissible={!busy}
		onDismiss={dismissImportOffer}
	>
		<p id="backup-import-offer-title" class="bottom-sheet__title">
			{translate(lang, csvReport ? 'settings.importCsvTitle' : 'settings.importConfirmTitle')}
		</p>
		{#if csvReport}
			<p class="bottom-sheet__hint">
				{translate(lang, 'settings.importCsvPreview', {
					sessions: csvReport.sessions,
					sets: csvReport.sets,
					from: csvReport.dateRange?.from.slice(0, 10) ?? '-',
					to: csvReport.dateRange?.to.slice(0, 10) ?? '-',
					matched: csvReport.matchedExercises,
					custom: csvReport.customExercises.length,
					skipped: csvReport.skippedRows
				})}
			</p>
			<p class="bottom-sheet__hint">{translate(lang, 'settings.importCsvKg')}</p>
			{#if showUnitToggle}
				<div class="mt-2 flex items-center gap-2">
					<span class="text-sm">{translate(lang, 'settings.importCsvUnit')}</span>
					{#each ['kg', 'lb'] as const as option (option)}
						<button
							type="button"
							class="rounded-lg border px-3 py-1 text-sm"
							class:border-[var(--color-accent)]={unit === option}
							class:border-[var(--color-border)]={unit !== option}
							aria-pressed={unit === option}
							disabled={busy}
							onclick={() => onUnitChange(option)}
						>
							{translate(lang, option === 'kg' ? 'settings.importCsvKgUnit' : 'settings.importCsvLbUnit')}
						</button>
					{/each}
				</div>
			{/if}
			{#if reviewRows.length > 0}
				<p class="bottom-sheet__hint">
					{translate(lang, 'settings.importCsvReview', { n: reviewRows.length })}
				</p>
				<ul class="mt-2 flex list-none flex-col gap-2 p-0">
					{#each reviewRows as row (row.key)}
						<li class="flex flex-col gap-1">
							<span class="text-sm font-semibold">{row.name}</span>
							<select
								class="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-sm"
								value={row.value}
								disabled={busy}
								onchange={(e) => onOverrideChange(row.key, e.currentTarget.value)}
							>
								<option value="">{translate(lang, 'settings.importCsvKeepNew')}</option>
								{#each row.candidates as candidate (candidate.id)}
									<option value={candidate.id}>{candidate.name}</option>
								{/each}
							</select>
						</li>
					{/each}
				</ul>
			{/if}
		{:else}
			<p class="bottom-sheet__hint">{translate(lang, 'settings.importConfirm')}</p>
		{/if}
		{#snippet actions()}
			<AppButton variant="secondary" disabled={busy} onclick={dismissImportOffer}>
				{translate(lang, 'common.cancel')}
			</AppButton>
			<AppButton disabled={busy} aria-busy={busy} onclick={() => void commitImport()}>
				{#if busy}
					<span class="inline-flex items-center justify-center gap-2">
						<Spinner size="sm" block={false} />
						{translate(lang, 'auth.wait')}
					</span>
				{:else}
					{translate(lang, 'settings.importConfirmCta')}
				{/if}
			</AppButton>
		{/snippet}
	</BottomSheet>
{/if}
