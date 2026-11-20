import type { RequestHandler } from './$types';
import {
	aiQuotaKey,
	aiDailyLimit,
	consumeAiDailyQuota,
	peekAiDailyQuota,
	refundAiDailyQuota,
	type AiQuotaStatus
} from '$lib/server/ai/aiDailyQuota';
import { createAiReplyCache } from '$lib/server/ai/aiReplyCache';
import { aiAvailability } from '$lib/server/ai/config';
import { tuneWorkoutPlan, type TunePlanErr, type TunePlanInput, type TunePlanOk } from '$lib/server/ai/tunePlan';
import { corsJson, corsPreflight } from '$lib/server/cors';
import { normalizePlanTuneRows } from '$lib/domain/planTune';
import { sanitizeAiBrief } from '$lib/domain/inputLimits';

export const OPTIONS: RequestHandler = async () => corsPreflight();

export const GET: RequestHandler = async () => {
	const status = aiAvailability();
	return corsJson(
		{ ...status, dailyLimit: aiDailyLimit() },
		{ status: status.available ? 200 : 503 }
	);
};

/**
 * One provider call per identical request (10 min), shared by concurrent callers.
 * The quota is spent before the model runs, so a repeat must not cost a second call.
 */
const replies = createAiReplyCache<TunePlanOk | TunePlanErr>({ ttlMs: 10 * 60_000, max: 128 });

function parsePlan(raw: unknown): TunePlanInput | null {
	if (!raw || typeof raw !== 'object') return null;
	const rec = raw as Record<string, unknown>;
	const exercises = normalizePlanTuneRows(rec.exercises);
	if (exercises.length === 0) return null;
	const name = String(rec.name ?? '').trim().slice(0, 48);
	return { name, exercises };
}

function replyKey(quotaKey: string, plan: TunePlanInput, brief: string): string {
	const rows = plan.exercises
		.map((row) => `${row.exerciseId}:${row.sets}x${row.reps}x${row.restSec}`)
		.join(',');
	return `${quotaKey}\n${plan.name}\n${brief}\n${rows}`;
}

function failure(result: TunePlanErr) {
	const status =
		result.code === 'unavailable'
			? 503
			: result.code === 'invalid_input'
				? 400
				: result.code === 'invalid_plan'
					? 422
					: 502;
	return corsJson(result, { status });
}

function reply(result: TunePlanOk | TunePlanErr, quota: AiQuotaStatus, cached: boolean) {
	if (!result.ok) return failure(result);
	return corsJson({
		...result,
		remaining: quota.remaining,
		limit: quota.limit,
		...(cached ? { cached: true } : {})
	});
}

export const POST: RequestHandler = async ({ request }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return corsJson(
			{ ok: false, code: 'invalid_input', error: 'Invalid JSON body' },
			{ status: 400 }
		);
	}

	const rec = (body ?? {}) as Record<string, unknown>;
	const brief = typeof rec.brief === 'string' ? sanitizeAiBrief(rec.brief) : '';
	if (!brief) {
		return corsJson(
			{ ok: false, code: 'invalid_input', error: 'Brief is required' },
			{ status: 400 }
		);
	}
	const plan = parsePlan(rec.plan);
	if (!plan) {
		return corsJson(
			{ ok: false, code: 'invalid_input', error: 'Plan with exercises is required' },
			{ status: 400 }
		);
	}

	const key = await aiQuotaKey(request);
	const cacheKey = replyKey(key, plan, brief);

	/* Cache hit: answer without touching quota or the provider. */
	const cachedCall = replies.get(cacheKey);
	if (cachedCall) {
		try {
			return reply(await cachedCall, peekAiDailyQuota(key), true);
		} catch {
			replies.drop(cacheKey);
			return corsJson({ ok: false, code: 'upstream', error: 'AI request failed' }, { status: 502 });
		}
	}

	const quota = consumeAiDailyQuota(key);
	if (!quota.ok) {
		return corsJson(
			{
				ok: false,
				code: 'rate_limit',
				error: 'aiDraft.rateLimit',
				limit: quota.limit,
				remaining: 0
			},
			{ status: 429 }
		);
	}

	let result: TunePlanOk | TunePlanErr;
	try {
		result = await replies.track(cacheKey, tuneWorkoutPlan(plan, brief));
	} catch {
		replies.drop(cacheKey);
		return corsJson({ ok: false, code: 'upstream', error: 'AI request failed' }, { status: 502 });
	}
	if (!result.ok) {
		/* Never serve an error from the cache; the provider was not asked when
		   it is unavailable, so give that call back to the athlete. */
		replies.drop(cacheKey);
		if (result.code === 'unavailable') refundAiDailyQuota(key);
		return failure(result);
	}
	return reply(result, quota, false);
};
