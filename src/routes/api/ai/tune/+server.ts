import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { AI_TUNE_NOTE_MAX, sanitizeAiBrief } from '$lib/domain/inputLimits';
import {
	clampTuneAbsolute,
	isTuneGoal,
	tunePrescription,
	type TuneGoal,
	type TuneInput,
	type TunePrior
} from '$lib/server/ai/tunePrescription';

function parsePrior(raw: unknown): TunePrior | undefined {
	if (!raw || typeof raw !== 'object') return undefined;
	const rec = raw as Record<string, unknown>;
	const sets = Number(rec.sets);
	const reps = Number(rec.reps);
	const restSec = Number(rec.restSec);
	if (!Number.isFinite(sets) || !Number.isFinite(reps) || !Number.isFinite(restSec)) {
		return undefined;
	}
	const clamped = clampTuneAbsolute(sets, reps, restSec);
	const why =
		typeof rec.why === 'string' ? sanitizeAiBrief(rec.why, AI_TUNE_NOTE_MAX) : undefined;
	return {
		...clamped,
		...(why ? { why } : {})
	};
}

function parseBody(body: unknown): TuneInput | null {
	if (!body || typeof body !== 'object') return null;
	const rec = body as Record<string, unknown>;
	const exerciseId = String(rec.exerciseId ?? '').trim();
	if (!exerciseId) return null;

	const goalRaw = rec.goal;
	const goal: TuneGoal | undefined = isTuneGoal(goalRaw) ? goalRaw : undefined;
	const lang = rec.lang === 'en' ? 'en' : rec.lang === 'ru' ? 'ru' : undefined;
	const note =
		typeof rec.note === 'string' ? sanitizeAiBrief(rec.note, AI_TUNE_NOTE_MAX) : undefined;
	const prior = parsePrior(rec.prior);

	const optionalNum = (v: unknown): number | undefined => {
		if (v === undefined || v === null || v === '') return undefined;
		const n = Number(v);
		return Number.isFinite(n) ? Math.round(n) : undefined;
	};

	return {
		exerciseId,
		sets: optionalNum(rec.sets),
		reps: optionalNum(rec.reps),
		restSec: optionalNum(rec.restSec),
		goal,
		note,
		prior,
		lang
	};
}

export const POST: RequestHandler = async ({ request }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json(
			{ ok: false, code: 'invalid_input', error: 'Invalid JSON body' },
			{ status: 400 }
		);
	}

	const input = parseBody(body);
	if (!input) {
		return json(
			{ ok: false, code: 'invalid_input', error: 'Missing exerciseId' },
			{ status: 400 }
		);
	}

	const result = await tunePrescription(input);
	if (!result.ok) {
		const status =
			result.code === 'unavailable'
				? 503
				: result.code === 'invalid_input'
					? 400
					: result.code === 'invalid_prescription'
						? 422
						: 502;
		return json(result, { status });
	}
	return json(result);
};
