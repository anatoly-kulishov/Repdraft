/**
 * Soft daily quotas for the capped AI paths.
 * In-memory per process: good enough to curb casual abuse on warm instances;
 * not a hard global ledger across all serverless isolates.
 *
 * Two buckets:
 * - text: free plan generation / tune, shared by three routes (default 10/day);
 * - recognize: Pro photo recognition, the vision model costs ~10x a text call
 *   (default 4/day). Excel/CSV parsing is local and never spends a call.
 */
import { env as privateEnv } from '$env/dynamic/private';
import { requireUser } from '$lib/server/auth/requireUser';
import { clientIp } from '$lib/server/clientIp';

const DEFAULT_DAILY_LIMIT = 10;
const DEFAULT_RECOGNIZE_DAILY_LIMIT = 4;

type Bucket = { day: string; count: number };

export type AiQuotaStatus = { limit: number; remaining: number; used: number };

export type AiQuotaResult =
	| { ok: true; limit: number; remaining: number; used: number }
	| { ok: false; limit: number; remaining: 0; used: number };

function utcDay(now = new Date()): string {
	return now.toISOString().slice(0, 10);
}

function limitFromEnv(name: string, fallback: number): number {
	const raw = Number((privateEnv[name] ?? '').trim());
	if (Number.isFinite(raw) && raw >= 1 && raw <= 1000) return Math.floor(raw);
	return fallback;
}

export function aiDailyLimit(): number {
	return limitFromEnv('AI_PLAN_DAILY_LIMIT', DEFAULT_DAILY_LIMIT);
}

export function aiRecognizeDailyLimit(): number {
	return limitFromEnv('AI_RECOGNIZE_DAILY_LIMIT', DEFAULT_RECOGNIZE_DAILY_LIMIT);
}

/** Prefer verified user id; fall back to IP. */
export async function aiQuotaKey(request: Request): Promise<string> {
	const authHeader = request.headers.get('authorization') ?? request.headers.get('Authorization');
	if (authHeader?.toLowerCase().startsWith('bearer ')) {
		const gate = await requireUser(request);
		if (gate.ok) return `u:${gate.user.id}`;
	}
	return `ip:${clientIp(request)}`;
}

type Quota = {
	peek(key: string, now?: Date): AiQuotaStatus;
	consume(key: string, now?: Date): AiQuotaResult;
	refund(key: string, now?: Date): void;
	reset(): void;
};

/** ponytail: process Map; ceiling = multi-instance drift. Upgrade: Redis/Supabase counter. */
function createQuota(limitOf: () => number): Quota {
	const buckets = new Map<string, Bucket>();

	/** Read-only view, for serving a cached reply without spending a call. */
	function peek(key: string, now = new Date()): AiQuotaStatus {
		const limit = limitOf();
		const day = utcDay(now);
		const prev = buckets.get(key);
		const used = prev && prev.day === day ? prev.count : 0;
		return { limit, used, remaining: Math.max(0, limit - used) };
	}

	/**
	 * Give a call back when the model was never asked (no provider configured).
	 * Never refund `upstream`/`invalid_plan`: those happened after the provider call.
	 */
	function refund(key: string, now = new Date()): void {
		const prev = buckets.get(key);
		if (!prev || prev.day !== utcDay(now) || prev.count <= 0) return;
		if (prev.count === 1) buckets.delete(key);
		else buckets.set(key, { day: prev.day, count: prev.count - 1 });
	}

	/**
	 * Atomically check+consume one call for the day.
	 * Call only when you are about to hit the LLM.
	 */
	function consume(key: string, now = new Date()): AiQuotaResult {
		const limit = limitOf();
		const day = utcDay(now);
		const prev = buckets.get(key);
		const used = prev && prev.day === day ? prev.count : 0;
		if (used >= limit) {
			return { ok: false, limit, remaining: 0, used };
		}
		const next = used + 1;
		buckets.set(key, { day, count: next });
		/* Occasional prune of stale days (keep map small on long-lived Node). */
		if (buckets.size > 4000) {
			for (const [k, b] of buckets) {
				if (b.day !== day) buckets.delete(k);
			}
		}
		return { ok: true, limit, remaining: Math.max(0, limit - next), used: next };
	}

	return { peek, consume, refund, reset: () => buckets.clear() };
}

const textQuota = createQuota(aiDailyLimit);
const recognizeQuota = createQuota(aiRecognizeDailyLimit);

export const peekAiDailyQuota = textQuota.peek;
export const consumeAiDailyQuota = textQuota.consume;
export const refundAiDailyQuota = textQuota.refund;

export const peekAiRecognizeQuota = recognizeQuota.peek;
export const consumeAiRecognizeQuota = recognizeQuota.consume;
export const refundAiRecognizeQuota = recognizeQuota.refund;

/** Test helper: clear buckets between checks. */
export function resetAiDailyQuotaForTests(): void {
	textQuota.reset();
	recognizeQuota.reset();
}

export function runAiDailyQuotaSelfCheck(): void {
	resetAiDailyQuotaForTests();
	const day = new Date('2026-06-01T12:00:00.000Z');
	const nextDay = new Date('2026-06-02T01:00:00.000Z');

	for (const [name, quota] of [
		['text', { consume: consumeAiDailyQuota, peek: peekAiDailyQuota, refund: refundAiDailyQuota }],
		[
			'recognize',
			{ consume: consumeAiRecognizeQuota, peek: peekAiRecognizeQuota, refund: refundAiRecognizeQuota }
		]
	] as const) {
		const key = `test:${name}`;
		const limit = name === 'text' ? aiDailyLimit() : aiRecognizeDailyLimit();
		for (let i = 0; i < limit; i++) {
			if (!quota.consume(key, day).ok) {
				throw new Error(`aiDailyQuota: ${name} should allow within limit`);
			}
		}
		if (quota.peek(key, day).used !== limit) {
			throw new Error(`aiDailyQuota: ${name} peek should not spend`);
		}
		if (quota.consume(key, day).ok) {
			throw new Error(`aiDailyQuota: ${name} should block over limit`);
		}
		if (!quota.consume(key, nextDay).ok) {
			throw new Error(`aiDailyQuota: ${name} should reset next UTC day`);
		}
		quota.refund(key, nextDay);
		if (quota.peek(key, nextDay).used !== 0) {
			throw new Error(`aiDailyQuota: ${name} refund should return the call`);
		}
		quota.refund(key, nextDay);
		if (quota.peek(key, nextDay).used !== 0) {
			throw new Error(`aiDailyQuota: ${name} refund must not go negative`);
		}
	}
	resetAiDailyQuotaForTests();
}
