/**
 * Soft daily quota for free AI (plan + tune).
 * In-memory per process: good enough to curb casual abuse on warm instances;
 * not a hard global ledger across all serverless isolates.
 */
import { env as privateEnv } from '$env/dynamic/private';
import { requireUser } from '$lib/server/auth/requireUser';

const DEFAULT_DAILY_LIMIT = 10;

type Bucket = { day: string; count: number };

/** ponytail: process Map; ceiling = multi-instance drift. Upgrade: Redis/Supabase counter. */
const buckets = new Map<string, Bucket>();

function utcDay(now = new Date()): string {
	return now.toISOString().slice(0, 10);
}

export function aiDailyLimit(): number {
	const raw = Number((privateEnv.AI_PLAN_DAILY_LIMIT ?? '').trim());
	if (Number.isFinite(raw) && raw >= 1 && raw <= 1000) return Math.floor(raw);
	return DEFAULT_DAILY_LIMIT;
}

export function clientIp(request: Request): string {
	const forwarded = request.headers.get('x-forwarded-for');
	if (forwarded) {
		const first = forwarded.split(',')[0]?.trim();
		if (first) return first.slice(0, 128);
	}
	const real = request.headers.get('x-real-ip')?.trim();
	if (real) return real.slice(0, 128);
	return 'unknown';
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

export type AiQuotaResult =
	| { ok: true; limit: number; remaining: number; used: number }
	| { ok: false; limit: number; remaining: 0; used: number };

/**
 * Atomically check+consume one AI call for the day.
 * Call only when you are about to hit the LLM.
 */
export function consumeAiDailyQuota(key: string, now = new Date()): AiQuotaResult {
	const limit = aiDailyLimit();
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

/** Test helper: clear buckets between checks. */
export function resetAiDailyQuotaForTests(): void {
	buckets.clear();
}

export function runAiDailyQuotaSelfCheck(): void {
	resetAiDailyQuotaForTests();
	const key = 'test:quota';
	const limit = aiDailyLimit();
	for (let i = 0; i < limit; i++) {
		const r = consumeAiDailyQuota(key, new Date('2026-06-01T12:00:00.000Z'));
		if (!r.ok) throw new Error('aiDailyQuota: should allow within limit');
	}
	const blocked = consumeAiDailyQuota(key, new Date('2026-06-01T18:00:00.000Z'));
	if (blocked.ok) throw new Error('aiDailyQuota: should block over limit');
	const nextDay = consumeAiDailyQuota(key, new Date('2026-06-02T01:00:00.000Z'));
	if (!nextDay.ok) throw new Error('aiDailyQuota: should reset next UTC day');
	resetAiDailyQuotaForTests();
}
