import type { WorkoutRepository } from '$lib/domain/repository';
import type { WorkoutSession } from '$lib/domain/types';
import { withTimeout } from '$lib/domain/withTimeout';
import { getSupabase, isSupabaseConfigured } from '$lib/supabase/client';
import { localRecordRepository } from './localRecordRepository';
import { localSessionRepository, clearFinishedSessions } from './localSessionRepository';
import { localWorkoutRepository } from './localWorkoutRepository';
import { supabaseRecordRepository } from './supabaseRecordRepository';
import {
	isSessionsTableMissing,
	isSessionsTableUnavailable,
	supabaseSessionRepository
} from './supabaseSessionRepository';
import { supabaseWorkoutRepository } from './supabaseWorkoutRepository';

let cloudMode = false;
/** When cloud session table is missing, keep using local for sessions. */
let sessionsCloudOk = true;

export function setCloudMode(enabled: boolean) {
	cloudMode = enabled && isSupabaseConfigured();
	// Do not flip sessionsCloudOk back to true — PGRST205 sticks until full reload.
	if (!cloudMode) return;
	if (isSessionsTableUnavailable()) sessionsCloudOk = false;
}

export function isCloudMode(): boolean {
	return cloudMode;
}

export function getWorkoutRepo(): WorkoutRepository {
	return cloudMode ? supabaseWorkoutRepository : localWorkoutRepository;
}

function markSessionsCloudDown(err: unknown) {
	sessionsCloudOk = false;
	const e = err as { code?: string; message?: string } | null;
	if (isSessionsTableMissing(e) || e?.message === 'SESSIONS_TABLE_MISSING') {
		console.warn(
			'session cloud skipped — create public.workout_sessions in Supabase (local SQL, not in git)'
		);
		return;
	}
	console.warn('session cloud skipped', err);
}

/** Always durable on device; also mirrors to cloud when available. */
export async function persistSession(session: WorkoutSession): Promise<void> {
	await localSessionRepository.save(session);
	if (!cloudMode || !sessionsCloudOk || isSessionsTableUnavailable()) return;
	try {
		await withTimeout(supabaseSessionRepository.save(session), 4000);
	} catch (err) {
		markSessionsCloudDown(err);
	}
}

export async function deleteSession(id: string): Promise<void> {
	await localSessionRepository.remove(id);
	if (!cloudMode || !sessionsCloudOk || isSessionsTableUnavailable()) return;
	try {
		await withTimeout(supabaseSessionRepository.remove(id), 4000);
	} catch (err) {
		markSessionsCloudDown(err);
	}
}

export async function clearFinishedSessionHistory(): Promise<void> {
	const finished = (await localSessionRepository.list()).filter((s) => s.finishedAt);
	clearFinishedSessions();
	if (!cloudMode || !sessionsCloudOk || isSessionsTableUnavailable()) return;
	for (const s of finished) {
		try {
			await withTimeout(supabaseSessionRepository.remove(s.id), 4000);
		} catch (err) {
			markSessionsCloudDown(err);
			break;
		}
	}
}

const CLOUD_LIST_MS = 4000;

/** Upload local-only data to cloud when logging in (merge by id). Never hang the UI. */
export async function migrateLocalToCloud(): Promise<void> {
	const supabase = getSupabase();
	if (!supabase || !cloudMode) return;

	try {
		const localPlans = await localWorkoutRepository.list();
		const cloudPlans = await withTimeout(supabaseWorkoutRepository.list(), CLOUD_LIST_MS);
		const cloudPlanIds = new Set(cloudPlans.map((p) => p.id));
		for (const plan of localPlans) {
			if (!cloudPlanIds.has(plan.id)) {
				await supabaseWorkoutRepository.save(plan);
			}
		}
	} catch (err) {
		console.warn('plan migrate skipped', err);
	}

	try {
		const localRecords = await localRecordRepository.list();
		const cloudRecords = await withTimeout(supabaseRecordRepository.list(), CLOUD_LIST_MS);
		const cloudRecordIds = new Set(cloudRecords.map((r) => r.exerciseId));
		for (const record of localRecords) {
			if (!cloudRecordIds.has(record.exerciseId)) {
				await supabaseRecordRepository.save(record);
			}
		}
	} catch (err) {
		console.warn('record migrate skipped', err);
	}

	if (!sessionsCloudOk || isSessionsTableUnavailable()) return;

	const localSessions = await localSessionRepository.list();
	void (async () => {
		try {
			const cloudSessions = await withTimeout(supabaseSessionRepository.list(), 2500);
			if (isSessionsTableUnavailable()) {
				sessionsCloudOk = false;
				return;
			}
			const cloudSessionIds = new Set(cloudSessions.map((s) => s.id));
			for (const session of localSessions) {
				if (!cloudSessionIds.has(session.id)) {
					await supabaseSessionRepository.save(session);
				}
			}
		} catch (err) {
			markSessionsCloudDown(err);
		}
	})();
}
