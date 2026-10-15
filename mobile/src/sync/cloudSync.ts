/**
 * Cloud mirror for RN: outbox + tombstones + pull merge.
 */
import { isCloudPersistableId } from '@repdraft/domain/id';
import { mergePersonalRecords } from '@repdraft/domain/records';
import {
	PLANS_STORAGE_KEY,
	RECORDS_STORAGE_KEY,
	SESSIONS_STORAGE_KEY
} from '@repdraft/domain/repository';
import { mergeWorkoutSessions } from '@repdraft/domain/session';
import type { PersonalRecord, WorkoutPlan, WorkoutSession } from '@repdraft/domain/types';
import { mergeWorkoutPlans } from '@repdraft/domain/workout';
import { getSupabase, isSupabaseConfigured } from '../auth/supabase';
import { kvSetJson } from '../storage/kv';
import { plansRepo } from '../storage/plansRepo';
import { recordsRepo } from '../storage/recordsRepo';
import { sessionsRepo } from '../storage/sessionsRepo';
import { dequeueOutbox, enqueueOutbox, listOutbox, type SyncOutboxEntry } from './outbox';
import { addSessionTombstone, listSessionTombstones } from './tombstones';

async function requireUserId(): Promise<string> {
	const sb = getSupabase();
	if (!sb) throw new Error('cloud off');
	const { data, error } = await sb.auth.getUser();
	if (error || !data.user) throw new Error('need auth');
	return data.user.id;
}

export async function isCloudReady(): Promise<boolean> {
	if (!isSupabaseConfigured()) return false;
	const sb = getSupabase();
	if (!sb) return false;
	const { data } = await sb.auth.getSession();
	return Boolean(data.session?.user);
}

export async function pushPlan(plan: WorkoutPlan): Promise<void> {
	await enqueueOutbox({ kind: 'plan.save', id: plan.id });
	await flushOutbox();
}

export async function pushSession(session: WorkoutSession): Promise<void> {
	await enqueueOutbox({ kind: 'session.save', id: session.id });
	await flushOutbox();
}

export async function pushRecord(record: PersonalRecord): Promise<void> {
	await enqueueOutbox({ kind: 'record.save', exerciseId: record.exerciseId });
	await flushOutbox();
}

export async function deleteSessionRemote(id: string): Promise<void> {
	await addSessionTombstone(id);
	await enqueueOutbox({ kind: 'session.delete', id });
	await flushOutbox();
}

export async function deletePlanRemote(id: string): Promise<void> {
	await enqueueOutbox({ kind: 'plan.delete', id });
	await flushOutbox();
}

export async function deleteRecordRemote(exerciseId: string): Promise<void> {
	await enqueueOutbox({ kind: 'record.delete', exerciseId });
	await flushOutbox();
}

async function upsertPlan(plan: WorkoutPlan): Promise<void> {
	if (!(await isCloudReady()) || !isCloudPersistableId(plan.id)) return;
	const sb = getSupabase()!;
	const userId = await requireUserId();
	const { error } = await sb.from('workout_plans').upsert(
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
}

async function upsertSession(session: WorkoutSession): Promise<void> {
	if (!(await isCloudReady()) || !isCloudPersistableId(session.id)) return;
	const sb = getSupabase()!;
	const userId = await requireUserId();
	const { error } = await sb.from('workout_sessions').upsert(
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
		if (error.code === 'PGRST205' || error.code === '42P01') return;
		throw error;
	}
}

async function upsertRecord(record: PersonalRecord): Promise<void> {
	if (!(await isCloudReady())) return;
	const sb = getSupabase()!;
	const userId = await requireUserId();
	const { error } = await sb.from('personal_records').upsert(
		{
			exercise_id: record.exerciseId,
			user_id: userId,
			weight_kg: record.weightKg,
			reps: record.reps,
			note: record.note,
			updated_at: record.updatedAt
		},
		{ onConflict: 'user_id,exercise_id' }
	);
	if (error) throw error;
}

async function deleteSessionCloud(id: string): Promise<void> {
	if (!(await isCloudReady()) || !isCloudPersistableId(id)) return;
	const sb = getSupabase()!;
	const { error } = await sb.from('workout_sessions').delete().eq('id', id);
	if (error && error.code !== 'PGRST205' && error.code !== '42P01') throw error;
}

async function deletePlanCloud(id: string): Promise<void> {
	if (!(await isCloudReady()) || !isCloudPersistableId(id)) return;
	const sb = getSupabase()!;
	const { error } = await sb.from('workout_plans').delete().eq('id', id);
	if (error) throw error;
}

async function deleteRecordCloud(exerciseId: string): Promise<void> {
	if (!(await isCloudReady())) return;
	const sb = getSupabase()!;
	const userId = await requireUserId();
	const { error } = await sb
		.from('personal_records')
		.delete()
		.eq('user_id', userId)
		.eq('exercise_id', exerciseId);
	if (error) throw error;
}

/** `done` = dequeue; `skip` = leave in queue (local entity not ready yet). */
async function applyOutboxEntry(entry: SyncOutboxEntry): Promise<'done' | 'skip'> {
	switch (entry.kind) {
		case 'plan.save': {
			const plan = await plansRepo.get(entry.id);
			if (!plan) return 'skip';
			await upsertPlan(plan);
			return 'done';
		}
		case 'plan.delete':
			await deletePlanCloud(entry.id);
			return 'done';
		case 'session.save': {
			const session = await sessionsRepo.get(entry.id);
			if (!session) return 'skip';
			await upsertSession(session);
			return 'done';
		}
		case 'session.delete':
			await deleteSessionCloud(entry.id);
			return 'done';
		case 'record.save': {
			const record = await recordsRepo.get(entry.exerciseId);
			if (!record) return 'skip';
			await upsertRecord(record);
			return 'done';
		}
		case 'record.delete':
			await deleteRecordCloud(entry.exerciseId);
			return 'done';
		default: {
			const _exhaustive: never = entry;
			return _exhaustive;
		}
	}
}

export async function flushOutbox(): Promise<{ flushed: number; remaining: number }> {
	if (!(await isCloudReady())) {
		return { flushed: 0, remaining: (await listOutbox()).length };
	}
	const queue = await listOutbox();
	let flushed = 0;
	for (const entry of queue) {
		try {
			const result = await applyOutboxEntry(entry);
			if (result === 'done') {
				await dequeueOutbox(entry);
				flushed += 1;
			}
		} catch {
			break;
		}
	}
	return { flushed, remaining: (await listOutbox()).length };
}

export async function pullAndMergeFromCloud(): Promise<{
	ok: boolean;
	message: string;
}> {
	if (!(await isCloudReady())) {
		return { ok: false, message: 'not signed in' };
	}
	await flushOutbox();
	const sb = getSupabase()!;
	const [localPlans, localSessions, localRecords, tombstones] = await Promise.all([
		plansRepo.list(),
		sessionsRepo.list(),
		recordsRepo.list(),
		listSessionTombstones()
	]);
	const tombSet = new Set(tombstones);

	const { data: planRows, error: planErr } = await sb
		.from('workout_plans')
		.select('id,name,exercises,created_at,updated_at');
	if (planErr) return { ok: false, message: planErr.message };

	const cloudPlans: WorkoutPlan[] = (planRows ?? []).map((row) => ({
		id: row.id as string,
		name: row.name as string,
		exercises: Array.isArray(row.exercises) ? row.exercises : [],
		createdAt: row.created_at as string,
		updatedAt: row.updated_at as string
	}));

	let cloudSessions: WorkoutSession[] = [];
	const { data: sessionRows, error: sessionErr } = await sb
		.from('workout_sessions')
		.select('id,plan_id,plan_name,started_at,finished_at,exercises');
	if (!sessionErr && sessionRows) {
		cloudSessions = sessionRows
			.map((row) => ({
				id: row.id as string,
				planId: (row.plan_id as string | null) ?? null,
				planName: row.plan_name as string,
				startedAt: row.started_at as string,
				finishedAt: (row.finished_at as string | null) ?? null,
				exercises: Array.isArray(row.exercises) ? row.exercises : []
			}))
			.filter((s) => !tombSet.has(s.id));
	}

	let cloudRecords: PersonalRecord[] = [];
	const { data: recordRows, error: recordErr } = await sb
		.from('personal_records')
		.select('exercise_id,weight_kg,reps,note,updated_at');
	if (!recordErr && recordRows) {
		cloudRecords = recordRows.map((row) => ({
			exerciseId: row.exercise_id as string,
			weightKg: (row.weight_kg as number | null) ?? null,
			reps: (row.reps as number | null) ?? null,
			note: typeof row.note === 'string' ? row.note : '',
			updatedAt: row.updated_at as string
		}));
	}

	const plans = mergeWorkoutPlans(localPlans, cloudPlans);
	const sessions = mergeWorkoutSessions(localSessions, cloudSessions).filter(
		(s) => !tombSet.has(s.id)
	);
	const records = mergePersonalRecords(localRecords, cloudRecords);

	await Promise.all([
		kvSetJson(PLANS_STORAGE_KEY, plans),
		kvSetJson(SESSIONS_STORAGE_KEY, sessions),
		kvSetJson(RECORDS_STORAGE_KEY, records)
	]);

	for (const plan of plans) {
		if (!isCloudPersistableId(plan.id)) continue;
		if (!cloudPlans.some((p) => p.id === plan.id)) {
			await enqueueOutbox({ kind: 'plan.save', id: plan.id });
		}
	}
	for (const session of sessions) {
		if (!session.finishedAt || !isCloudPersistableId(session.id)) continue;
		if (!cloudSessions.some((s) => s.id === session.id)) {
			await enqueueOutbox({ kind: 'session.save', id: session.id });
		}
	}
	const cloudRecordIds = new Set(cloudRecords.map((r) => r.exerciseId));
	for (const record of records) {
		if (!cloudRecordIds.has(record.exerciseId)) {
			await enqueueOutbox({ kind: 'record.save', exerciseId: record.exerciseId });
		}
	}
	await flushOutbox();

	return {
		ok: true,
		message: `${plans.length} plans, ${sessions.length} sessions, ${records.length} records`
	};
}

export { outboxCount } from './outbox';
