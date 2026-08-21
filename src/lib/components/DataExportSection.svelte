<script lang="ts">
	import {
		buildExportPayload,
		exportPayloadToJson,
		exportStamp,
		mergeLocalWithImport,
		parseExportJson
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
	import Spinner from '$lib/components/Spinner.svelte';

	let lang = $derived($resolvedLocale);
	let busy = $state<'json' | 'import' | null>(null);
	let fileInput: HTMLInputElement | undefined = $state();

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

		if (!confirm(translate(lang, 'settings.importConfirm'))) return;

		busy = 'import';
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

			const current = await loadLocalBundle();
			const merged = mergeLocalWithImport(current, parsed.payload);

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
		} catch (err) {
			toasts.show(translateError(lang, err, 'settings.importFail'), 'error');
		} finally {
			busy = null;
		}
	}
</script>

<div class="auth-account__section">
	<p class="auth-prefs__title">{translate(lang, 'settings.exportTitle')}</p>
	<p class="mt-1 text-xs text-[var(--color-muted)]">{translate(lang, 'settings.exportHint')}</p>
	<div class="data-export-actions mt-3">
		<button
			type="button"
			class="btn-secondary data-export-actions__btn min-h-[48px] min-w-[48px]"
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
