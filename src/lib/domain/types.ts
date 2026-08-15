export type BodyPart =
	| 'back'
	| 'cardio'
	| 'chest'
	| 'lower arms'
	| 'lower legs'
	| 'neck'
	| 'shoulders'
	| 'upper arms'
	| 'upper legs'
	| 'waist';

export type ExerciseIndexItem = {
	id: string;
	name: string;
	/** Russian display title (generated; falls back to name). */
	name_ru?: string;
	body_part: string;
	equipment: string;
	target: string;
	muscle_group: string;
	secondary_muscles: string[];
	image: string;
	/** Present on full exercise payloads; omitted from the slim catalog index. */
	gif_url?: string;
};

export type Exercise = ExerciseIndexItem & {
	category: string;
	instructions: Record<string, string>;
	instruction_steps: Record<string, string[]>;
	media_id: string;
	attribution: string;
	created_at: string;
	gif_url: string;
};

export type WorkoutExercise = {
	exerciseId: string;
	sets: number;
	reps: number;
	restSec: number;
	/** Same id = one superset / giant set (contiguous block in the list). */
	groupId?: string | null;
};

export type WorkoutPlan = {
	id: string;
	name: string;
	createdAt: string;
	updatedAt: string;
	exercises: WorkoutExercise[];
};

export type ExerciseFilters = {
	query: string;
	bodyPart: BodyPart | 'all' | 'legs';
	equipment: string | 'all';
	target: string | 'all';
};

/** Optional personal best for an exercise — any fields may be empty except exerciseId. */
export type PersonalRecord = {
	exerciseId: string;
	weightKg: number | null;
	reps: number | null;
	note: string;
	updatedAt: string;
};

/** One logged working set during a live session. */
export type SetKind = 'work' | 'warmup' | 'drop';

export type LoggedSet = {
	weightKg: number | null;
	reps: number | null;
	completed: boolean;
	/** Omit / undefined = working set (back-compat with stored sessions). */
	kind?: SetKind;
};

export type SessionExercise = {
	exerciseId: string;
	groupId?: string | null;
	targetSets: number;
	targetReps: number;
	restSec: number;
	sets: LoggedSet[];
};

/** In-progress or finished workout run (performance, not prescription). */
export type WorkoutSession = {
	id: string;
	planId: string | null;
	planName: string;
	startedAt: string;
	finishedAt: string | null;
	exercises: SessionExercise[];
};

/** Compact “last time” hint for the live logger. */
export type LastPerformance = {
	weightKg: number | null;
	reps: number | null;
	sets: number;
	finishedAt: string;
};
