import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { aiAvailability } from '$lib/server/ai/config';
import { generateWorkoutPlan } from '$lib/server/ai/generatePlan';

export const GET: RequestHandler = async () => {
	const status = aiAvailability();
	return json(status, { status: status.available ? 200 : 503 });
};

export const POST: RequestHandler = async ({ request }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, code: 'invalid_brief', error: 'Invalid JSON body' }, { status: 400 });
	}

	const brief =
		body && typeof body === 'object' && 'brief' in body
			? String((body as { brief: unknown }).brief ?? '')
			: '';

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
		return json(result, { status });
	}
	return json(result);
};
