import type { RecordRepository, SessionRepository, WorkoutRepository } from '$lib/domain/repository';
import type { WorkoutSession } from '$lib/domain/types';
import { withTimeout } from '$lib/domain/withTimeout';
import { getSupabase, isSupabaseConfigured } from '$lib/supabase/client';
import { localRecordRepository } from './localRecordRepository';
import { localSessionRepository } from './localSessionRepository';
import { localWorkoutRepository } from './localWorkoutRepository';
import { supabaseRecordRepository } from './supabaseRecordRepository';
import { supabaseSessionRepository } from './supabaseSessionRepository';
import { supabaseWorkoutRepository } from './supabaseWorkoutRepository';

let cloudMode = false;
/** When cloud session table is missing, keep using local for sessions. */
let sessionsCloudOk = true;

export function setCloudMode(enabled: boolean) {
	cloudMode = enabled && isSupabaseConfigured();
	sessionsCloudOk = true;
}

export function isCloudMode(): boolean {
	return cloudMode;
}

export function getWorkoutRepo(): WorkoutRepository {
	return cloudMode ? supabaseWorkoutRepository : localWorkoutRepository;
}

export function getRecordRepo(): RecordRepository {
	return cloudMode ? supabaseRecordRepository : localRecordRepository;
}

export function getSessionRepo(): SessionRepository {
	if (cloudMode && sessionsCloudOk) return supabaseSessionRepository;
	return localSessionRepository;
}

/** Always durable on device; also mirrors to cloud when available. */
export async function persistSession(session: WorkoutSession): Promise<void> {
	await localSessionRepository.save(session);
	if (!cloudMode) return;
	try {
		await withTimeout(supabaseSessionRepository.save(session), 4000);
		sessionsCloudOk = true;
	} catch (err) {
		sessionsCloudOk = false;
		console.warn('session cloud save skipped', err);
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

	const localSessions = await localSessionRepository.list();
	void (async () => {
		try {
			const cloudSessions = await withTimeout(supabaseSessionRepository.list(), 2500);
			const cloudSessionIds = new Set(cloudSessions.map((s) => s.id));
			for (const session of localSessions) {
				if (!cloudSessionIds.has(session.id)) {
					await supabaseSessionRepository.save(session);
				}
			}
			sessionsCloudOk = true;
		} catch (err) {
			sessionsCloudOk = false;
			console.warn('session migrate skipped (create workout_sessions locally)', err);
		}
	})();
}
