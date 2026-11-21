/**
 * Feedback form rules shared by `/feedback` and `POST /api/feedback`.
 *
 * The same validator runs in the browser and on the server, so a field the page
 * accepts is a field the endpoint accepts. Nothing here touches the DOM, mail or
 * storage: the server adds transport and request metadata on top.
 */

export const FEEDBACK_KINDS = ['bug', 'idea', 'other'] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const FEEDBACK_MESSAGE_MIN = 5;
export const FEEDBACK_MESSAGE_MAX = 2000;
export const FEEDBACK_EMAIL_MAX = 120;
export const FEEDBACK_PAGE_MAX = 200;

/** A bot fills every input it can see; humans never see this one. */
export const FEEDBACK_HONEYPOT_FIELD = 'website';

export type FeedbackLang = 'ru' | 'en';

export type FeedbackInput = {
	kind: FeedbackKind;
	message: string;
	/** Optional reply address; `null` when the form was left empty. */
	email: string | null;
	/** App pathname the user came from (`/progress`), never a full URL. */
	page: string | null;
	lang: FeedbackLang;
};

export type FeedbackFieldError = 'kind' | 'message' | 'email';

export type FeedbackValidation =
	| { ok: true; value: FeedbackInput }
	| { ok: false; field: FeedbackFieldError; errorKey: string };

export function isFeedbackKind(value: unknown): value is FeedbackKind {
	return (
		typeof value === 'string' && (FEEDBACK_KINDS as readonly string[]).includes(value)
	);
}

/**
 * Trim, unify line breaks, drop control characters, keep paragraphs.
 * Length is a hard cap, not a silent truncation of the message body on send:
 * the validator refuses anything above the cap before this runs.
 */
export function sanitizeFeedbackText(raw: unknown, max: number): string {
	if (typeof raw !== 'string') return '';
	return raw
		.replace(/\r\n?/g, '\n')
		.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
		.replace(/\n{3,}/g, '\n\n')
		.replace(/[ \t]+$/gm, '')
		.trim()
		.slice(0, max);
}

/** `https://site/progress?x=1` and `/progress?x=1` both become `/progress`. */
export function sanitizeFeedbackPage(raw: unknown): string | null {
	if (typeof raw !== 'string') return null;
	let path = raw.trim();
	if (!path) return null;
	if (/^https?:\/\//i.test(path)) {
		try {
			path = new URL(path).pathname;
		} catch {
			return null;
		}
	}
	path = path.split('?')[0]?.split('#')[0] ?? '';
	if (!path.startsWith('/')) return null;
	return sanitizeFeedbackText(path, FEEDBACK_PAGE_MAX) || null;
}

/** Empty stays empty; non-empty must look like an address we can reply to. */
export function normalizeFeedbackEmail(raw: unknown): string | null {
	if (typeof raw !== 'string') return null;
	const email = raw.trim().slice(0, FEEDBACK_EMAIL_MAX);
	if (!email) return null;
	return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : null;
}

export function validateFeedback(raw: unknown): FeedbackValidation {
	if (!raw || typeof raw !== 'object') {
		return { ok: false, field: 'message', errorKey: 'feedback.errorRequired' };
	}
	const rec = raw as Record<string, unknown>;

	const kind = rec.kind ?? 'other';
	if (!isFeedbackKind(kind)) {
		return { ok: false, field: 'kind', errorKey: 'feedback.errorKind' };
	}

	const message = sanitizeFeedbackText(rec.message, FEEDBACK_MESSAGE_MAX + 1);
	if (!message) {
		return { ok: false, field: 'message', errorKey: 'feedback.errorRequired' };
	}
	if (message.length > FEEDBACK_MESSAGE_MAX) {
		return { ok: false, field: 'message', errorKey: 'feedback.errorLong' };
	}
	if (message.length < FEEDBACK_MESSAGE_MIN) {
		return { ok: false, field: 'message', errorKey: 'feedback.errorShort' };
	}

	const emailRaw = typeof rec.email === 'string' ? rec.email.trim() : '';
	const email = normalizeFeedbackEmail(emailRaw);
	if (emailRaw && !email) {
		return { ok: false, field: 'email', errorKey: 'feedback.errorEmail' };
	}

	return {
		ok: true,
		value: {
			kind,
			message,
			email,
			page: sanitizeFeedbackPage(rec.page),
			lang: rec.lang === 'en' ? 'en' : 'ru'
		}
	};
}

/** Translation key for the selected kind (chips, subject line). */
export function feedbackKindLabelKey(kind: FeedbackKind): string {
	switch (kind) {
		case 'bug':
			return 'feedback.kindBug';
		case 'idea':
			return 'feedback.kindIdea';
		default:
			return 'feedback.kindOther';
	}
}

/** One-line inbox subject: kind + first words of the message. */
export function feedbackSubject(kindLabel: string, message: string): string {
	const firstLine = message
		.split('\n')[0]
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 70);
	const label = kindLabel.replace(/[\r\n]+/g, ' ').trim() || 'Feedback';
	return firstLine ? `[Repdraft] ${label}: ${firstLine}` : `[Repdraft] ${label}`;
}

/** Guards the form contract shared by the page and the API. */
export function runFeedbackSelfCheck(): void {
	const long = sanitizeFeedbackText('a'.repeat(FEEDBACK_MESSAGE_MAX + 50), FEEDBACK_MESSAGE_MAX);
	if (long.length !== FEEDBACK_MESSAGE_MAX) throw new Error('feedback: text cap broken');

	const cleaned = sanitizeFeedbackText('  Привет\r\n\r\n\r\nмир\u0007  ', FEEDBACK_MESSAGE_MAX);
	if (cleaned !== 'Привет\n\nмир') throw new Error(`feedback: control chars ${JSON.stringify(cleaned)}`);

	const empty = validateFeedback({ message: '   ' });
	if (empty.ok || empty.errorKey !== 'feedback.errorRequired') {
		throw new Error('feedback: empty message accepted');
	}

	const short = validateFeedback({ message: 'ой' });
	if (short.ok || short.errorKey !== 'feedback.errorShort') {
		throw new Error('feedback: too short message accepted');
	}

	const badEmail = validateFeedback({ message: 'Не работает кнопка старта', email: 'nope' });
	if (badEmail.ok || badEmail.field !== 'email') throw new Error('feedback: bad email accepted');

	const ok = validateFeedback({
		kind: 'bug',
		message: 'Не работает кнопка старта\nна экране тренировки',
		email: 'athlete@example.com',
		page: 'https://www.repdraft.ru/live/abc?x=1#top',
		lang: 'ru'
	});
	if (!ok.ok) throw new Error(`feedback: valid input rejected (${ok.errorKey})`);
	if (ok.value.page !== '/live/abc') throw new Error(`feedback: page ${ok.value.page}`);
	if (ok.value.email !== 'athlete@example.com') throw new Error('feedback: email lost');

	const unknownKind = validateFeedback({ kind: 'spam', message: 'Привет, тест' });
	if (unknownKind.ok || unknownKind.field !== 'kind') {
		throw new Error('feedback: unknown kind accepted');
	}

	const subject = feedbackSubject('Баг', 'a'.repeat(200));
	if (subject.includes('\n') || subject.length > 100) {
		throw new Error(`feedback: subject ${subject.length}`);
	}
}
