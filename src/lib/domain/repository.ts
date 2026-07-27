import type { PersonalRecord, WorkoutPlan } from './types';

export interface WorkoutRepository {
	list(): Promise<WorkoutPlan[]>;
	get(id: string): Promise<WorkoutPlan | null>;
	save(plan: WorkoutPlan): Promise<void>;
	remove(id: string): Promise<void>;
}

export interface RecordRepository {
	list(): Promise<PersonalRecord[]>;
	get(exerciseId: string): Promise<PersonalRecord | null>;
	save(record: PersonalRecord): Promise<void>;
	remove(exerciseId: string): Promise<void>;
}

export const PLANS_STORAGE_KEY = 'repdraft:plans';
export const DRAFT_STORAGE_KEY = 'repdraft:draft';
export const RECORDS_STORAGE_KEY = 'repdraft:records';
