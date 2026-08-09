import type { RecordRepository } from '$lib/domain/repository';
import type { PersonalRecord } from '$lib/domain/types';
import { getSupabase } from '$lib/supabase/client';

type RecordRow = {
	exercise_id: string;
	weight_kg: number | null;
	reps: number | null;
	note: string;
	updated_at: string;
};

function rowToRecord(row: RecordRow): PersonalRecord {
	return {
		exerciseId: row.exercise_id,
		weightKg: row.weight_kg,
		reps: row.reps,
		note: row.note ?? '',
		updatedAt: row.updated_at
	};
}

async function requireUserId(): Promise<string> {
	const supabase = getSupabase();
	if (!supabase) throw new Error('errors.cloudOff');
	const { data, error } = await supabase.auth.getUser();
	if (error || !data.user) throw new Error('errors.needAuth');
	return data.user.id;
}

export const supabaseRecordRepository: RecordRepository = {
	async list() {
		const supabase = getSupabase();
		if (!supabase) return [];
		const { data, error } = await supabase
			.from('personal_records')
			.select('exercise_id,weight_kg,reps,note,updated_at')
			.order('updated_at', { ascending: false });
		if (error) throw error;
		return (data as RecordRow[] | null)?.map(rowToRecord) ?? [];
	},

	async get(exerciseId: string) {
		const supabase = getSupabase();
		if (!supabase) return null;
		const { data, error } = await supabase
			.from('personal_records')
			.select('exercise_id,weight_kg,reps,note,updated_at')
			.eq('exercise_id', exerciseId)
			.maybeSingle();
		if (error) throw error;
		return data ? rowToRecord(data as RecordRow) : null;
	},

	async save(record: PersonalRecord) {
		const supabase = getSupabase();
		if (!supabase) throw new Error('errors.cloudOff');
		const userId = await requireUserId();
		const { error } = await supabase.from('personal_records').upsert(
			{
				user_id: userId,
				exercise_id: record.exerciseId,
				weight_kg: record.weightKg,
				reps: record.reps,
				note: record.note,
				updated_at: record.updatedAt
			},
			{ onConflict: 'user_id,exercise_id' }
		);
		if (error) throw error;
	},

	async remove(exerciseId: string) {
		const supabase = getSupabase();
		if (!supabase) throw new Error('errors.cloudOff');
		const { error } = await supabase
			.from('personal_records')
			.delete()
			.eq('exercise_id', exerciseId);
		if (error) throw error;
	}
};
