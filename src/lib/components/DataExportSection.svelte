<script lang="ts">
	import {
		buildExportPayload,
		exportPayloadToJson,
		exportStamp,
		mergeLocalWithImport,
		parseExportJson,
		type RepdraftExportPayload
	} from '$lib/domain/exportData';
	import { translate, translateError } from '$lib/i18n/messages';
	import { downloadBlob } from '$lib/media/downloadBlob';
	import { localRecordRepository } from '$lib/storage/localRecordRepository';
	import { localSessionRepository } from '$lib/storage/localSessionRepository';
	import { localWorkoutRepository } from '$lib/storage/localWorkoutRepository';
	import { live } from '$lib/stores/live';
	import { resolvedLocale } from '$lib/stores/locale';
	import { plans } from '$lib/stores/plans';
	import { records } from '$lib/stores/records';
	import { toasts } from '$lib/stores/toasts';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	let lang = $derived($resolvedLocale);
	let busy = $state<'json' | 'import' | null>(null);
	let fileInput: HTMLInputElement | undefined = $state();
	let pendingPayload = $state<RepdraftExportPayload | null>(null);
	let importOfferOpen = $state(false);

	async function loadLocalBundle() {
		const [plansList, sessions, recordsList] = await Promise.all([
			localWorkoutRepository.list(),
			localSessionRepository.list(),
			localRecordRepository.list()
		]);
		return { plans: plansList, sessions, records: recordsList };
	}

	async function exportJson() {
		if (busy) return;
		busy = 'json';
		try {
			const { plans: plansList, sessions, records: recordsList } = await loadLocalBundle();
			if (plansList.length === 0 && sessions.length === 0 && recordsList.length === 0) {
				toasts.show(translate(lang, 'settings.exportEmpty'), 'info');
				return;
			}
			const payload = buildExportPayload(plansList, sessions, recordsList);
			const blob = new Blob([exportPayloadToJson(payload)], {
				type: 'application/json;charset=utf-8'
			});
			downloadBlob(blob, `repdraft-backup-${exportStamp()}.json`);
			toasts.show(translate(lang, 'settings.exportDone'), 'success');
		} catch (err) {
			toasts.show(translateError(lang, err, 'settings.exportFail'), 'error');
		} finally {
			busy = null;
		}
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
			if (!parsed.ok) {
				const key =
					parsed.reason === 'invalidJson'
						? 'settings.importInvalidJson'
						: parsed.reason === 'unsupportedVersion'
							? 'settings.importUnsupported'
							: 'settings.importInvalidShape';
				toasts.show(translate(lang, key), 'error');
				return;
			}
			pendingPayload = parsed.payload;
			importOfferOpen = true;
		} catch (err) {
			toasts.show(translateError(lang, err, 'settings.importFail'), 'error');
		}
	}

	function dismissImportOffer() {
		if (busy === 'import') return;
		importOfferOpen = false;
		pendingPayload = null;
	}

	async function commitImport() {
		if (!pendingPayload || busy) return;
		busy = 'import';
		try {
			const current = await loadLocalBundle();
			const merged = mergeLocalWithImport(current, pendingPayload);

			await Promise.all([
				...merged.plans.map((plan) => localWorkoutRepository.save(plan)),
				...merged.sessions.map((session) => localSessionRepository.save(session)),
				...merged.records.map((record) => localRecordRepository.save(record))
			]);

			await Promise.all([
				plans.refresh({ cloud: false, force: true }),
				records.refresh({ cloud: false, force: true }),
				live.refreshHistory()
			]);

			toasts.show(translate(lang, 'settings.importDone'), 'success');
			importOfferOpen = false;
			pendingPayload = null;
		} catch (err) {
			toasts.show(translateError(lang, err, 'settings.importFail'), 'error');
		} finally {
			busy = null;
		}
	}
</script>

<div class="auth-account__section">
	<p class="auth-prefs__title">{translate(lang, 'settings.exportTitle')}</p>
	<p class="mt-1 text-sm text-[var(--color-muted)]">{translate(lang, 'settings.exportHint')}</p>
	<div class="data-export-actions mt-3">
		<button
			type="button"
			class="btn-primary data-export-actions__btn min-h-[48px] min-w-[48px]"
			disabled={busy !== null}
			onclick={() => void exportJson()}
		>
			{#if busy === 'json'}
				<span class="inline-flex items-center gap-2">
					<Spinner size="sm" block={false} />
					{translate(lang, 'auth.wait')}
				</span>
			{:else}
				{translate(lang, 'settings.exportJson')}
			{/if}
		</button>
		<button
			type="button"
			class="btn-secondary data-export-actions__btn min-h-[48px] min-w-[48px]"
			disabled={busy !== null}
			onclick={openImportPicker}
		>
			{#if busy === 'import'}
				<span class="inline-flex items-center gap-2">
					<Spinner size="sm" block={false} />
					{translate(lang, 'auth.wait')}
				</span>
			{:else}
				{translate(lang, 'settings.importJson')}
			{/if}
		</button>
		<input
			bind:this={fileInput}
			type="file"
			accept="application/json,.json"
			class="sr-only"
			tabindex="-1"
			onchange={(e) => void onImportFile(e)}
		/>
	</div>
</div>

{#if importOfferOpen}
	<BottomSheet
		open={importOfferOpen}
		titleId="settings-import-offer-title"
		dismissible={busy !== 'import'}
		onDismiss={dismissImportOffer}
	>
		<p id="settings-import-offer-title" class="bottom-sheet__title">
			{translate(lang, 'settings.importConfirmTitle')}
		</p>
		<p class="bottom-sheet__hint">{translate(lang, 'settings.importConfirm')}</p>
		{#snippet actions()}
			<button
				type="button"
				class="btn-secondary min-h-12"
				disabled={busy === 'import'}
				onclick={dismissImportOffer}
			>
				{translate(lang, 'common.cancel')}
			</button>
			<button
				type="button"
				class="btn-primary min-h-12"
				disabled={busy === 'import'}
				aria-busy={busy === 'import'}
				onclick={() => void commitImport()}
			>
				{translate(lang, 'settings.importJson')}
			</button>
		{/snippet}
	</BottomSheet>
{/if}
