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
	body_part: string;
	equipment: string;
	target: string;
	muscle_group: string;
	secondary_muscles: string[];
	image: string;
	gif_url: string;
};

export type Exercise = ExerciseIndexItem & {
	category: string;
	instructions: Record<string, string>;
	instruction_steps: Record<string, string[]>;
	media_id: string;
	attribution: string;
	created_at: string;
};

export type WorkoutExercise = {
	exerciseId: string;
	sets: number;
	reps: number;
	restSec: number;
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
	bodyPart: BodyPart | 'all';
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
