import type { RequestHandler } from './$types';
import { env as publicEnv } from '$env/dynamic/public';
import {
	FEEDBACK_HONEYPOT_FIELD,
	feedbackKindLabelKey,
	validateFeedback
} from '$lib/domain/feedback';
import { createRateLimitWindow } from '$lib/domain/rateLimitWindow';
import { translate } from '$lib/i18n/messages';
import { corsJson, corsPreflight } from '$lib/server/cors';
import { clientIp } from '$lib/server/clientIp';
import { feedbackFallbackEmail, feedbackMailConfig } from '$lib/server/feedback/config';
import { sendFeedbackMail } from '$lib/server/feedback/sendFeedbackMail';

/** 5 messages per hour per IP: a real user never hits it, a loop does. */
const limiter = createRateLimitWindow({ limit: 5, windowMs: 60 * 60 * 1000 });
const BODY_LIMIT = 32_000;

function noStore(response: Response): Response {
	response.headers.set('Cache-Control', 'no-store');
	return response;
}

function originOf(value: string | undefined): string | null {
	const raw = (value ?? '').trim();
	if (!raw) return null;
	try {
		return new URL(raw).origin;
	} catch {
		return null;
	}
}

/**
 * Browsers send `Origin` on cross-site POSTs; native clients and curl usually do
 * not. Reject a foreign browser origin, keep the API open for the app.
 */
function originRejected(request: Request): boolean {
	const origin = request.headers.get('origin');
	if (!origin) return false;
	if (origin === 'null') return true;
	try {
		const parsed = new URL(origin);
		if (parsed.origin === new URL(request.url).origin) return false;
		const allowed = new Set(
			[originOf(publicEnv.PUBLIC_SITE_URL), originOf(publicEnv.PUBLIC_WEB_ORIGIN)].filter(
				(value): value is string => Boolean(value)
			)
		);
		if (allowed.has(parsed.origin)) return false;
		// Local dev + Expo web; harmless outside development because nothing else matches.
		if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') return false;
		return true;
	} catch {
		return true;
	}
}

export const OPTIONS: RequestHandler = async () => corsPreflight();

export const POST: RequestHandler = async ({ request }) => {
	const length = Number(request.headers.get('content-length') ?? '0');
	if (Number.isFinite(length) && length > BODY_LIMIT) {
		return noStore(corsJson({ ok: false, error: 'feedback.errorLong' }, { status: 413 }));
	}
	if (originRejected(request)) {
		return noStore(corsJson({ ok: false, error: 'feedback.sendFail' }, { status: 403 }));
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return noStore(corsJson({ ok: false, error: 'feedback.errorRequired' }, { status: 400 }));
	}

	// Honeypot: a bot fills it, a human cannot see it. Pretend success.
	const honeypot =
		body && typeof body === 'object'
			? (body as Record<string, unknown>)[FEEDBACK_HONEYPOT_FIELD]
			: null;
	if (typeof honeypot === 'string' && honeypot.trim()) {
		console.warn('feedback: honeypot filled, message dropped');
		return noStore(corsJson({ ok: true }));
	}

	const validated = validateFeedback(body);
	if (!validated.ok) {
		return noStore(
			corsJson(
				{ ok: false, field: validated.field, error: validated.errorKey },
				{ status: 400 }
			)
		);
	}
	const input = validated.value;

	const gate = limiter.hit(clientIp(request));
	if (!gate.ok) {
		const retryAfter = Math.max(1, Math.ceil(gate.retryAfterMs / 1000));
		const response = corsJson(
			{
				ok: false,
				error: 'feedback.rateLimited',
				retryAfter,
				minutes: Math.max(1, Math.ceil(retryAfter / 60))
			},
			{ status: 429 }
		);
		response.headers.set('Retry-After', String(retryAfter));
		return noStore(response);
	}

	const cfg = feedbackMailConfig();
	if (!cfg) {
		return noStore(
			corsJson(
				{ ok: false, error: 'feedback.unavailable', email: feedbackFallbackEmail() },
				{ status: 503 }
			)
		);
	}

	const bodyRec = (body ?? {}) as Record<string, unknown>;
	const appVersion =
		String(bodyRec.appVersion ?? '')
			.replace(/[^\d.a-zA-Z-]/g, '')
			.slice(0, 24) || 'unknown';
	const origin = request.headers.get('origin');
	const kindLabel = translate(input.lang, feedbackKindLabelKey(input.kind));

	try {
		await sendFeedbackMail(
			input,
			{
				kindLabel,
				lang: input.lang,
				appVersion,
				origin: origin === null ? null : origin.slice(0, 200),
				userAgent: request.headers.get('user-agent')?.slice(0, 300) ?? null,
				sentAt: new Date()
			},
			cfg
		);
	} catch (err) {
		console.error('feedback: sendMail failed', err);
		return noStore(corsJson({ ok: false, error: 'feedback.sendFail' }, { status: 500 }));
	}

	console.info(`feedback: sent ${input.kind} (${input.message.length} chars)`);
	return noStore(corsJson({ ok: true }));
};
