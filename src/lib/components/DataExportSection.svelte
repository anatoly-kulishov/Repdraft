<script lang="ts">
	import {
		buildExportPayload,
		exportPayloadToJson,
		exportStamp,
		sessionsToCsv
	} from '$lib/domain/exportData';
	import { translate, translateError } from '$lib/i18n/messages';
	import { downloadBlob } from '$lib/media/downloadBlob';
	import { localRecordRepository } from '$lib/storage/localRecordRepository';
	import { localSessionRepository } from '$lib/storage/localSessionRepository';
	import { localWorkoutRepository } from '$lib/storage/localWorkoutRepository';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';
	import Spinner from '$lib/components/Spinner.svelte';

	let lang = $derived($resolvedLocale);
	let exporting = $state<'json' | 'csv' | null>(null);

	async function loadLocalBundle() {
		const [plans, sessions, records] = await Promise.all([
			localWorkoutRepository.list(),
			localSessionRepository.list(),
			localRecordRepository.list()
		]);
		return { plans, sessions, records };
	}

	async function exportJson() {
		if (exporting) return;
		exporting = 'json';
		try {
			const { plans, sessions, records } = await loadLocalBundle();
			if (plans.length === 0 && sessions.length === 0 && records.length === 0) {
				toasts.show(translate(lang, 'settings.exportEmpty'), 'info');
				return;
			}
			const payload = buildExportPayload(plans, sessions, records);
			const blob = new Blob([exportPayloadToJson(payload)], {
				type: 'application/json;charset=utf-8'
			});
			downloadBlob(blob, `repdraft-backup-${exportStamp()}.json`);
			toasts.show(translate(lang, 'settings.exportDone'), 'success');
		} catch (err) {
			toasts.show(translateError(lang, err, 'settings.exportFail'), 'error');
		} finally {
			exporting = null;
		}
	}

	async function exportCsv() {
		if (exporting) return;
		exporting = 'csv';
		try {
			const sessions = await localSessionRepository.list();
			if (sessions.length === 0) {
				toasts.show(translate(lang, 'settings.exportEmpty'), 'info');
				return;
			}
			const blob = new Blob([sessionsToCsv(sessions)], {
				type: 'text/csv;charset=utf-8'
			});
			downloadBlob(blob, `repdraft-sessions-${exportStamp()}.csv`);
			toasts.show(translate(lang, 'settings.exportDone'), 'success');
		} catch (err) {
			toasts.show(translateError(lang, err, 'settings.exportFail'), 'error');
		} finally {
			exporting = null;
		}
	}
</script>

<div class="auth-account__section">
	<p class="auth-prefs__title">{translate(lang, 'settings.exportTitle')}</p>
	<p class="mt-1 text-xs text-[var(--color-muted)]">{translate(lang, 'settings.exportHint')}</p>
	<div class="mt-3 flex flex-col gap-2 sm:flex-row">
		<button
			type="button"
			class="btn-secondary min-h-11"
			disabled={exporting !== null}
			onclick={() => void exportJson()}
		>
			{#if exporting === 'json'}
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
			class="btn-secondary min-h-11"
			disabled={exporting !== null}
			onclick={() => void exportCsv()}
		>
			{#if exporting === 'csv'}
				<span class="inline-flex items-center gap-2">
					<Spinner size="sm" block={false} />
					{translate(lang, 'auth.wait')}
				</span>
			{:else}
				{translate(lang, 'settings.exportCsv')}
			{/if}
		</button>
	</div>
</div>
