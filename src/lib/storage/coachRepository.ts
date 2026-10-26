/**
 * Coach mode over Supabase (Phase 2).
 * Schema lives outside the repo: `~/.repdraft-sql/coach-mode.sql`.
 * Errors from RPCs carry SQLSTATE RDC01..RDC05 — mapped to typed reasons here
 * so the UI never shows a raw Postgres message.
 */
import { getSupabase } from '$lib/supabase/client';
import type { CoachClientLink, CoachSessionSummary } from '$lib/domain/coach';

export type CoachErrorReason =
	| 'notConfigured'
	| 'offline'
	| 'limit'
	| 'notFound'
	| 'used'
	| 'expired'
	| 'self'
	| 'unknown';

export type CoachResult<T> = { ok: true; value: T } | { ok: false; reason: CoachErrorReason };

type LinkRow = {
	id: string;
	coach_user_id: string;
	client_user_id: string;
	status: CoachClientLink['status'];
	note: string | null;
	created_at: string;
	updated_at: string;
};

type StatsRow = {
	client_user_id: string;
	sessions: number | string;
	sessions_7d: number | string;
	sets_done: number | string;
	volume_kg: number | string | null;
	last_session_at: string | null;
};

export type CoachClientStatsRow = {
	clientUserId: string;
	summary: CoachSessionSummary;
};

export type CoachRecentSession = {
	id: string;
	planName: string;
	finishedAt: string;
	sets: number;
	volumeKg: number;
};

/** SQLSTATE → reason. PostgREST reports function errors in `code`. */
function reasonFromError(code: string | undefined, message: string | undefined): CoachErrorReason {
	switch (code) {
		case 'RDC01':
			return 'limit';
		case 'RDC02':
			return 'notFound';
		case 'RDC03':
			return 'used';
		case 'RDC04':
			return 'expired';
		case 'RDC05':
			return 'self';
		case '28000':
			return 'notConfigured';
		default:
			return message?.includes('Failed to fetch') ? 'offline' : 'unknown';
	}
}

function rowToLink(row: LinkRow): CoachClientLink {
	return {
		id: row.id,
		coachUserId: row.coach_user_id,
		clientUserId: row.client_user_id,
		status: row.status,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		...(row.note ? { note: row.note } : {})
	};
}

function num(value: number | string | null | undefined): number {
	if (value == null) return 0;
	const parsed = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

function rowToStats(row: StatsRow): CoachClientStatsRow {
	return {
		clientUserId: row.client_user_id,
		summary: {
			sessions: num(row.sessions),
			sessions7d: num(row.sessions_7d),
			sets: num(row.sets_done),
			volumeKg: Math.round(num(row.volume_kg)),
			lastSessionAt: row.last_session_at ?? null,
			activeRecently: row.last_session_at
				? Date.now() - Date.parse(row.last_session_at) <= 2 * 86_400_000
				: false
		}
	};
}

export const coachRepository = {
	async listLinks(): Promise<CoachResult<CoachClientLink[]>> {
		const supabase = getSupabase();
		if (!supabase) return { ok: false, reason: 'notConfigured' };
		const { data, error } = await supabase
			.from('coach_links')
			.select('id,coach_user_id,client_user_id,status,note,created_at,updated_at')
			.order('updated_at', { ascending: false });
		if (error) return { ok: false, reason: reasonFromError(error.code, error.message) };
		return { ok: true, value: (data as LinkRow[] | null)?.map(rowToLink) ?? [] };
	},

	/** Active links where the current user is the client (their coaches). */
	async listClientLinks(clientUserId: string): Promise<CoachResult<CoachClientLink[]>> {
		const supabase = getSupabase();
		if (!supabase) return { ok: false, reason: 'notConfigured' };
		const { data, error } = await supabase
			.from('coach_links')
			.select('id,coach_user_id,client_user_id,status,note,created_at,updated_at')
			.eq('client_user_id', clientUserId)
			.eq('status', 'active')
			.order('updated_at', { ascending: false });
		if (error) return { ok: false, reason: reasonFromError(error.code, error.message) };
		return { ok: true, value: (data as LinkRow[] | null)?.map(rowToLink) ?? [] };
	},

	async createInvite(): Promise<CoachResult<string>> {
		const supabase = getSupabase();
		if (!supabase) return { ok: false, reason: 'notConfigured' };
		const { data, error } = await supabase.rpc('create_coach_invite');
		if (error) return { ok: false, reason: reasonFromError(error.code, error.message) };
		return { ok: true, value: String(data ?? '') };
	},

	async acceptInvite(code: string): Promise<CoachResult<string>> {
		const supabase = getSupabase();
		if (!supabase) return { ok: false, reason: 'notConfigured' };
		const { data, error } = await supabase.rpc('accept_coach_invite', { p_code: code });
		if (error) return { ok: false, reason: reasonFromError(error.code, error.message) };
		return { ok: true, value: String(data ?? '') };
	},

	async stats(): Promise<CoachResult<CoachClientStatsRow[]>> {
		const supabase = getSupabase();
		if (!supabase) return { ok: false, reason: 'notConfigured' };
		const { data, error } = await supabase.rpc('coach_client_stats', { p_client: null });
		if (error) return { ok: false, reason: reasonFromError(error.code, error.message) };
		return { ok: true, value: (data as StatsRow[] | null)?.map(rowToStats) ?? [] };
	},

	async recentSessions(clientUserId: string, limit = 5): Promise<CoachResult<CoachRecentSession[]>> {
		const supabase = getSupabase();
		if (!supabase) return { ok: false, reason: 'notConfigured' };
		const { data, error } = await supabase.rpc('coach_client_sessions', {
			p_client: clientUserId,
			p_limit: limit
		});
		if (error) return { ok: false, reason: reasonFromError(error.code, error.message) };
		const rows = (data as
			| { id: string; plan_name: string | null; finished_at: string; sets_done: number | string; volume_kg: number | string | null }[]
			| null) ?? [];
		return {
			ok: true,
			value: rows
				.filter((row) => Boolean(row.finished_at))
				.map((row) => ({
					id: row.id,
					planName: row.plan_name ?? '',
					finishedAt: row.finished_at,
					sets: num(row.sets_done),
					volumeKg: Math.round(num(row.volume_kg))
				}))
		};
	},

	async revoke(linkId: string): Promise<CoachResult<true>> {
		const supabase = getSupabase();
		if (!supabase) return { ok: false, reason: 'notConfigured' };
		const { error } = await supabase
			.from('coach_links')
			.update({ status: 'revoked' })
			.eq('id', linkId);
		if (error) return { ok: false, reason: reasonFromError(error.code, error.message) };
		return { ok: true, value: true };
	}
};
