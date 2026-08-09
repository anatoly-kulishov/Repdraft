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

/** Sticky for this page load once PostgREST says the table is absent. */
let tableMissing = false;

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

/** Table missing / not in schema cache (PGRST205) or similar. */
export function isSessionsTableMissing(error: { code?: string; message?: string } | null): boolean {
	if (!error) return false;
	if (error.code === 'PGRST205' || error.code === '42P01') return true;
	return /workout_sessions|schema cache|does not exist/i.test(error.message ?? '');
}

export function isSessionsTableUnavailable(): boolean {
	return tableMissing;
}

function markTableMissing() {
	tableMissing = true;
}

async function requireUserId(): Promise<string> {
	const supabase = getSupabase();
	if (!supabase) throw new Error('errors.cloudOff');
	const { data, error } = await supabase.auth.getUser();
	if (error || !data.user) throw new Error('errors.needAuth');
	return data.user.id;
}

/**
 * Requires local table `workout_sessions` (not shipped in public git).
 * After PGRST205, all methods no-op / throw without further HTTP.
 */
export const supabaseSessionRepository: SessionRepository = {
	async list() {
		if (tableMissing) return [];
		const supabase = getSupabase();
		if (!supabase) return [];
		const { data, error } = await supabase
			.from('workout_sessions')
			.select('id,plan_id,plan_name,started_at,finished_at,exercises')
			.order('started_at', { ascending: false });
		if (error) {
			if (isSessionsTableMissing(error)) {
				markTableMissing();
				const err = new Error('SESSIONS_TABLE_MISSING') as Error & { code: string };
				err.code = 'PGRST205';
				throw err;
			}
			throw error;
		}
		return (data as SessionRow[] | null)?.map(rowToSession) ?? [];
	},

	async get(id: string) {
		if (tableMissing) return null;
		const supabase = getSupabase();
		if (!supabase) return null;
		const { data, error } = await supabase
			.from('workout_sessions')
			.select('id,plan_id,plan_name,started_at,finished_at,exercises')
			.eq('id', id)
			.maybeSingle();
		if (error) {
			if (isSessionsTableMissing(error)) {
				markTableMissing();
				return null;
			}
			throw error;
		}
		return data ? rowToSession(data as SessionRow) : null;
	},

	async save(session: WorkoutSession) {
		if (tableMissing) throw Object.assign(new Error('SESSIONS_TABLE_MISSING'), { code: 'PGRST205' });
		const supabase = getSupabase();
		if (!supabase) throw new Error('errors.cloudOff');
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
		if (error) {
			if (isSessionsTableMissing(error)) markTableMissing();
			throw error;
		}
	},

	async remove(id: string) {
		if (tableMissing) return;
		const supabase = getSupabase();
		if (!supabase) throw new Error('errors.cloudOff');
		const { error } = await supabase.from('workout_sessions').delete().eq('id', id);
		if (error) {
			if (isSessionsTableMissing(error)) {
				markTableMissing();
				return;
			}
			throw error;
		}
	}
};
