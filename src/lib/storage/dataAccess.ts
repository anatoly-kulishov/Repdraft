import type { RecordRepository, WorkoutRepository } from '$lib/domain/repository';
import { getSupabase, isSupabaseConfigured } from '$lib/supabase/client';
import { localRecordRepository } from './localRecordRepository';
import { localWorkoutRepository } from './localWorkoutRepository';
import { supabaseRecordRepository } from './supabaseRecordRepository';
import { supabaseWorkoutRepository } from './supabaseWorkoutRepository';

let cloudMode = false;

export function setCloudMode(enabled: boolean) {
	cloudMode = enabled && isSupabaseConfigured();
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

/** Upload local-only data to cloud when logging in (merge by id). */
export async function migrateLocalToCloud(): Promise<void> {
	const supabase = getSupabase();
	if (!supabase || !cloudMode) return;

	const localPlans = await localWorkoutRepository.list();
	const cloudPlans = await supabaseWorkoutRepository.list();
	const cloudPlanIds = new Set(cloudPlans.map((p) => p.id));

	for (const plan of localPlans) {
		if (!cloudPlanIds.has(plan.id)) {
			await supabaseWorkoutRepository.save(plan);
		}
	}

	const localRecords = await localRecordRepository.list();
	const cloudRecords = await supabaseRecordRepository.list();
	const cloudRecordIds = new Set(cloudRecords.map((r) => r.exerciseId));

	for (const record of localRecords) {
		if (!cloudRecordIds.has(record.exerciseId)) {
			await supabaseRecordRepository.save(record);
		}
	}
}
