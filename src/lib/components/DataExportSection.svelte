<script lang="ts">
	import {
		buildExportPayload,
		exportPayloadToJson,
		exportStamp
	} from '$lib/domain/exportData';
	import { translate, translateError } from '$lib/i18n/messages';
	import { downloadBlob } from '$lib/media/downloadBlob';
	import { localRecordRepository } from '$lib/storage/localRecordRepository';
	import { localSessionRepository } from '$lib/storage/localSessionRepository';
	import { localWorkoutRepository } from '$lib/storage/localWorkoutRepository';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';
	import BackupImportAction from '$lib/components/BackupImportAction.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	let lang = $derived($resolvedLocale);
	let exportBusy = $state(false);

	async function loadLocalBundle() {
		const [plansList, sessions, recordsList] = await Promise.all([
			localWorkoutRepository.list(),
			localSessionRepository.list(),
			localRecordRepository.list()
		]);
		return { plans: plansList, sessions, records: recordsList };
	}

	async function exportJson() {
		if (exportBusy) return;
		exportBusy = true;
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
			exportBusy = false;
		}
	}
</script>

<div class="auth-account__section">
	<p class="auth-prefs__title">{translate(lang, 'settings.exportTitle')}</p>
	<p class="mt-1 text-sm text-[var(--color-muted)]">{translate(lang, 'settings.exportHint')}</p>
	<div class="data-export-actions mt-3">
		<button
			type="button"
			class="btn-primary data-export-actions__btn"
			disabled={exportBusy}
			onclick={() => void exportJson()}
		>
			{#if exportBusy}
				<span class="inline-flex items-center gap-2">
					<Spinner size="sm" block={false} />
					{translate(lang, 'auth.wait')}
				</span>
			{:else}
				{translate(lang, 'settings.exportJson')}
			{/if}
		</button>
		<BackupImportAction block class="data-export-actions__btn" />
	</div>
</div>
