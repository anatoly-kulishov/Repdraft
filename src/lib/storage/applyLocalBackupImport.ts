import {
	mergeLocalWithImport,
	type RepdraftExportPayload
} from '$lib/domain/exportData';
import { isCloudMode } from '$lib/storage/dataAccess';
import { peekLocalCustomExercises, replaceAllCustomExercises } from '$lib/storage/localCustomExerciseRepository';
import { localRecordRepository, replaceAllRecords } from '$lib/storage/localRecordRepository';
import { localSessionRepository, replaceAllSessions } from '$lib/storage/localSessionRepository';
import { localWorkoutRepository, replaceAllPlans } from '$lib/storage/localWorkoutRepository';
import { syncImportedPayloadToCloud } from '$lib/stores/cloudLocal';
import { live } from '$lib/stores/live';
import { plans } from '$lib/stores/plans';
import { records } from '$lib/stores/records';
import { syncState } from '$lib/stores/syncState';

async function loadLocalBundle() {
	const [plansList, sessions, recordsList] = await Promise.all([
		localWorkoutRepository.list(),
		localSessionRepository.list(),
		localRecordRepository.list()
	]);
	return { plans: plansList, sessions, records: recordsList, customs: peekLocalCustomExercises() };
}

/** Merge payload into local storage (bulk writes) and refresh stores. */
export async function applyLocalBackupImport(
	payload: RepdraftExportPayload
): Promise<{ cloudSynced: boolean; useCloud: boolean }> {
	const current = await loadLocalBundle();
	const merged = mergeLocalWithImport(current, payload);

	syncState.beginLocalSave();
	try {
		replaceAllPlans(merged.plans);
		replaceAllSessions(merged.sessions);
		replaceAllRecords(merged.records);
		replaceAllCustomExercises(merged.customs ?? []);
		syncState.markLocalSaved();
	} catch (err) {
		syncState.markLocalSaveError();
		throw err;
	}

	const cloudSynced = await syncImportedPayloadToCloud(payload);
	const useCloud = isCloudMode();
	await Promise.all([
		plans.refresh({ cloud: useCloud, force: true }),
		records.refresh({ cloud: useCloud, force: true }),
		live.refreshHistory()
	]);
	return { cloudSynced, useCloud };
}
