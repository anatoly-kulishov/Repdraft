import type { WorkoutRepository } from '$lib/domain/repository';
import type { WorkoutExercise, WorkoutPlan } from '$lib/domain/types';
import { getSupabase } from '$lib/supabase/client';
import { requireUserId } from './supabaseAuth';

type PlanRow = {
	id: string;
	name: string;
	exercises: WorkoutExercise[];
	created_at: string;
	updated_at: string;
};

function rowToPlan(row: PlanRow): WorkoutPlan {
	return {
		id: row.id,
		name: row.name,
		exercises: Array.isArray(row.exercises) ? row.exercises : [],
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

export const supabaseWorkoutRepository: WorkoutRepository = {
	async list() {
		const supabase = getSupabase();
		if (!supabase) return [];
		const { data, error } = await supabase
			.from('workout_plans')
			.select('id,name,exercises,created_at,updated_at')
			.order('updated_at', { ascending: false });
		if (error) throw error;
		return (data as PlanRow[] | null)?.map(rowToPlan) ?? [];
	},

	async get(id: string) {
		const supabase = getSupabase();
		if (!supabase) return null;
		const { data, error } = await supabase
			.from('workout_plans')
			.select('id,name,exercises,created_at,updated_at')
			.eq('id', id)
			.maybeSingle();
		if (error) throw error;
		return data ? rowToPlan(data as PlanRow) : null;
	},

	async save(plan: WorkoutPlan) {
		const supabase = getSupabase();
		if (!supabase) throw new Error('errors.cloudOff');
		const userId = await requireUserId();
		const { error } = await supabase.from('workout_plans').upsert(
			{
				id: plan.id,
				user_id: userId,
				name: plan.name,
				exercises: plan.exercises,
				created_at: plan.createdAt,
				updated_at: plan.updatedAt
			},
			{ onConflict: 'id' }
		);
		if (error) throw error;
	},

	async remove(id: string) {
		const supabase = getSupabase();
		if (!supabase) throw new Error('errors.cloudOff');
		const { error } = await supabase.from('workout_plans').delete().eq('id', id);
		if (error) throw error;
	}
};
