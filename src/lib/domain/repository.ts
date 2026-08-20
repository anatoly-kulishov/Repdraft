import type { PersonalRecord, WorkoutPlan, WorkoutSession } from './types';

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

export interface SessionRepository {
	list(): Promise<WorkoutSession[]>;
	get(id: string): Promise<WorkoutSession | null>;
	save(session: WorkoutSession): Promise<void>;
	remove(id: string): Promise<void>;
}

export const PLANS_STORAGE_KEY = 'repdraft:plans';
export const DRAFT_STORAGE_KEY = 'repdraft:draft';
export const RECORDS_STORAGE_KEY = 'repdraft:records';
export const SESSIONS_STORAGE_KEY = 'repdraft:sessions';
export const SESSIONS_DELETED_KEY = 'repdraft:sessions-deleted';
export const ACTIVE_SESSION_KEY = 'repdraft:active-session';
export const BOOKMARKS_STORAGE_KEY = 'repdraft:bookmarks';
export const REST_UNTIL_STORAGE_KEY = 'repdraft:rest-until';
export const EXERCISE_STATS_STORAGE_KEY = 'repdraft:exercise-stats';

export interface BookmarkRepository {
	list(): Promise<string[]>;
	add(exerciseId: string): Promise<void>;
	remove(exerciseId: string): Promise<void>;
}
