import {
	mergeLocalWithImport,
	type RepdraftExportPayload
} from '$lib/domain/exportData';
import { isCloudMode } from '$lib/storage/dataAccess';
import { localRecordRepository, replaceAllRecords } from '$lib/storage/localRecordRepository';
import { localSessionRepository, replaceAllSessions } from '$lib/storage/localSessionRepository';
import { localWorkoutRepository, replaceAllPlans } from '$lib/storage/localWorkoutRepository';
import { syncImportedPayloadToCloud } from '$lib/stores/cloudLocal';
import { live } from '$lib/stores/live';
import { plans } from '$lib/stores/plans';
import { records } from '$lib/stores/records';

/** Served from `static/dev/` (committed fixture; regenerate via `npm run gen:stress-backup`). */
export const DEV_STRESS_BACKUP_HREF = '/dev/repdraft-backup-stress-load.json';

async function loadLocalBundle() {
	const [plansList, sessions, recordsList] = await Promise.all([
		localWorkoutRepository.list(),
		localSessionRepository.list(),
		localRecordRepository.list()
	]);
	return { plans: plansList, sessions, records: recordsList };
}

/** Merge payload into local storage (bulk writes) and refresh stores. */
export async function applyLocalBackupImport(
	payload: RepdraftExportPayload
): Promise<{ cloudSynced: boolean; useCloud: boolean }> {
	const current = await loadLocalBundle();
	const merged = mergeLocalWithImport(current, payload);

	replaceAllPlans(merged.plans);
	replaceAllSessions(merged.sessions);
	replaceAllRecords(merged.records);

	const cloudSynced = await syncImportedPayloadToCloud(payload);
	const useCloud = isCloudMode();
	await Promise.all([
		plans.refresh({ cloud: useCloud, force: true }),
		records.refresh({ cloud: useCloud, force: true }),
		live.refreshHistory()
	]);
	return { cloudSynced, useCloud };
}
