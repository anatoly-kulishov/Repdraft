import nodemailer, { type Transporter } from 'nodemailer';
import { feedbackSubject, type FeedbackInput, type FeedbackLang } from '$lib/domain/feedback';
import type { FeedbackMailConfig } from './config';

export type FeedbackMailMeta = {
	/** Localized kind label for the subject («Баг» / «Bug»). */
	kindLabel: string;
	lang: FeedbackLang;
	appVersion: string;
	origin: string | null;
	userAgent: string | null;
	sentAt: Date;
};

const FROM_NAME = 'Repdraft';

/** One transport per process: Yandex throttles fresh connections, not sends. */
let cached: { key: string; transport: Transporter } | null = null;

function transportFor(cfg: FeedbackMailConfig): Transporter {
	const key = `${cfg.host}:${cfg.port}:${cfg.user}`;
	if (cached?.key === key) return cached.transport;
	const transport = nodemailer.createTransport({
		host: cfg.host,
		port: cfg.port,
		secure: cfg.secure,
		auth: { user: cfg.user, pass: cfg.pass },
		connectionTimeout: 8_000,
		greetingTimeout: 8_000,
		socketTimeout: 15_000
	});
	cached = { key, transport };
	return transport;
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function field(label: string, value: string): string {
	return `<p style="margin:0 0 4px"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`;
}

/** Reply-To only when the user typed a real address; otherwise mail stays one-way. */
export async function sendFeedbackMail(
	input: FeedbackInput,
	meta: FeedbackMailMeta,
	cfg: FeedbackMailConfig
): Promise<void> {
	const kindLabel = meta.kindLabel.replace(/[\r\n]+/g, ' ').trim();
	const lines = [
		`Тип: ${kindLabel}`,
		`Язык: ${meta.lang}`,
		`Страница: ${input.page ?? 'не указана'}`,
		`Версия: ${meta.appVersion}`,
		`Ответить: ${input.email ?? 'не указан'}`,
		`Время: ${meta.sentAt.toISOString()}`,
		...(meta.origin ? [`Origin: ${meta.origin}`] : []),
		...(meta.userAgent ? [`UA: ${meta.userAgent}`] : []),
		'',
		'Сообщение:',
		input.message
	];

	const html = `<div style="font:14px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a">
${field('Тип', kindLabel)}
${field('Язык', meta.lang)}
${field('Страница', input.page ?? 'не указана')}
${field('Версия', meta.appVersion)}
${field('Ответить', input.email ?? 'не указан')}
${field('Время', meta.sentAt.toISOString())}
${meta.origin ? field('Origin', meta.origin) : ''}
${meta.userAgent ? field('UA', meta.userAgent) : ''}
<hr style="border:none;border-top:1px solid #e5e5e5;margin:12px 0" />
<pre style="white-space:pre-wrap;font:14px/1.5 inherit;margin:0">${escapeHtml(input.message)}</pre>
</div>`;

	await transportFor(cfg).sendMail({
		from: { name: FROM_NAME, address: cfg.from },
		to: cfg.to,
		subject: feedbackSubject(kindLabel, input.message),
		text: lines.join('\n'),
		html,
		...(input.email ? { replyTo: { address: input.email } } : {}),
		headers: { 'X-Repdraft-Kind': input.kind }
	});
}
