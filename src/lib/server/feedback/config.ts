import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

/**
 * SMTP settings for the feedback form (Yandex 360 by default).
 *
 * Yandex requires an app password (`smtp.yandex.ru`, port 465, implicit TLS);
 * the account password does not work for SMTP. `FEEDBACK_EMAIL_TO` falls back to
 * the public privacy contact so the form works as soon as the SMTP pair is set.
 */
export type FeedbackMailConfig = {
	host: string;
	port: number;
	secure: boolean;
	user: string;
	pass: string;
	to: string;
	from: string;
};

function value(name: string): string {
	return (privateEnv[name] ?? '').trim();
}

export function feedbackFallbackEmail(): string {
	return (
		value('FEEDBACK_EMAIL_TO') ||
		(publicEnv.PUBLIC_PRIVACY_CONTACT_EMAIL ?? '').trim()
	);
}

export function feedbackMailConfig(): FeedbackMailConfig | null {
	const user = value('FEEDBACK_SMTP_USER');
	const pass = value('FEEDBACK_SMTP_PASS');
	const host = value('FEEDBACK_SMTP_HOST') || 'smtp.yandex.ru';
	const portRaw = Number(value('FEEDBACK_SMTP_PORT') || '465');
	const port = Number.isFinite(portRaw) && portRaw > 0 && portRaw < 65536 ? portRaw : 465;
	const secureRaw = value('FEEDBACK_SMTP_SECURE');
	const secure = secureRaw ? secureRaw === 'true' || secureRaw === '1' : port === 465;
	const to = feedbackFallbackEmail();
	const from = value('FEEDBACK_EMAIL_FROM') || user;

	if (!user || !pass || !to || !from || !host) return null;
	return { host, port, secure, user, pass, to, from };
}
