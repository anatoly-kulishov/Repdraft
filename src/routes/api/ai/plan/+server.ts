import type { RequestHandler } from './$types';
import { aiQuotaKey, aiDailyLimit, consumeAiDailyQuota } from '$lib/server/ai/aiDailyQuota';
import { aiAvailability } from '$lib/server/ai/config';
import { generateWorkoutPlan } from '$lib/server/ai/generatePlan';
import { corsJson, corsPreflight } from '$lib/server/cors';

export const OPTIONS: RequestHandler = async () => corsPreflight();

export const GET: RequestHandler = async () => {
	const status = aiAvailability();
	return corsJson(
		{ ...status, dailyLimit: aiDailyLimit() },
		{ status: status.available ? 200 : 503 }
	);
};

export const POST: RequestHandler = async ({ request }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return corsJson(
			{ ok: false, code: 'invalid_brief', error: 'Invalid JSON body' },
			{ status: 400 }
		);
	}

	const brief =
		body && typeof body === 'object' && 'brief' in body
			? String((body as { brief: unknown }).brief ?? '')
			: '';

	if (!brief.trim()) {
		return corsJson(
			{ ok: false, code: 'invalid_brief', error: 'Brief is required' },
			{ status: 400 }
		);
	}

	const key = await aiQuotaKey(request);
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

	const result = await generateWorkoutPlan(brief);
	if (!result.ok) {
		const status =
			result.code === 'unavailable'
				? 503
				: result.code === 'invalid_brief'
					? 400
					: result.code === 'invalid_plan'
						? 422
						: 502;
		return corsJson(result, { status });
	}
	return corsJson({ ...result, remaining: quota.remaining, limit: quota.limit });
};
