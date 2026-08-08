import type { SessionRepository } from '$lib/domain/repository';
import type { SessionExercise, WorkoutSession } from '$lib/domain/types';
import { getSupabase } from '$lib/supabase/client';

type SessionRow = {
	id: string;
	plan_id: string | null;
	plan_name: string;
	started_at: string;
	finished_at: string | null;
	exercises: SessionExercise[];
};

function rowToSession(row: SessionRow): WorkoutSession {
	return {
		id: row.id,
		planId: row.plan_id,
		planName: row.plan_name,
		startedAt: row.started_at,
		finishedAt: row.finished_at,
		exercises: Array.isArray(row.exercises) ? row.exercises : []
	};
}

async function requireUserId(): Promise<string> {
	const supabase = getSupabase();
	if (!supabase) throw new Error('Supabase не настроен');
	const { data, error } = await supabase.auth.getUser();
	if (error || !data.user) throw new Error('Нужно войти в аккаунт');
	return data.user.id;
}

/**
 * Requires local table `workout_sessions` (not shipped in public git).
 * If the table is missing, callers should fall back to local storage.
 */
export const supabaseSessionRepository: SessionRepository = {
	async list() {
		const supabase = getSupabase();
		if (!supabase) return [];
		const { data, error } = await supabase
			.from('workout_sessions')
			.select('id,plan_id,plan_name,started_at,finished_at,exercises')
			.order('started_at', { ascending: false });
		if (error) throw error;
		return (data as SessionRow[] | null)?.map(rowToSession) ?? [];
	},

	async get(id: string) {
		const supabase = getSupabase();
		if (!supabase) return null;
		const { data, error } = await supabase
			.from('workout_sessions')
			.select('id,plan_id,plan_name,started_at,finished_at,exercises')
			.eq('id', id)
			.maybeSingle();
		if (error) throw error;
		return data ? rowToSession(data as SessionRow) : null;
	},

	async save(session: WorkoutSession) {
		const supabase = getSupabase();
		if (!supabase) throw new Error('Supabase не настроен');
		const userId = await requireUserId();
		const { error } = await supabase.from('workout_sessions').upsert(
			{
				id: session.id,
				user_id: userId,
				plan_id: session.planId,
				plan_name: session.planName,
				started_at: session.startedAt,
				finished_at: session.finishedAt,
				exercises: session.exercises
			},
			{ onConflict: 'id' }
		);
		if (error) throw error;
	},

	async remove(id: string) {
		const supabase = getSupabase();
		if (!supabase) throw new Error('Supabase не настроен');
		const { error } = await supabase.from('workout_sessions').delete().eq('id', id);
		if (error) throw error;
	}
};
