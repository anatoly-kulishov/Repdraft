import { randomUUID } from 'node:crypto';
import type { ProPlan } from '$lib/domain/entitlement';
import {
	billingReturnUrl,
	resolveYooKassaConfig,
	yooKassaAmount,
	type YooKassaConfig
} from './config';

type YooPayment = {
	id: string;
	status: string;
	paid?: boolean;
	amount?: { value: string; currency: string };
	confirmation?: { confirmation_url?: string };
	metadata?: Record<string, string>;
};

function basicAuth(cfg: YooKassaConfig): string {
	return Buffer.from(`${cfg.shopId}:${cfg.secretKey}`).toString('base64');
}

async function yooFetch(
	cfg: YooKassaConfig,
	path: string,
	init: { method: string; body?: unknown; idempotenceKey?: string }
): Promise<{ status: number; json: unknown }> {
	const headers: Record<string, string> = {
		Authorization: `Basic ${basicAuth(cfg)}`,
		'Content-Type': 'application/json',
		Accept: 'application/json'
	};
	if (init.idempotenceKey) headers['Idempotence-Key'] = init.idempotenceKey;

	const res = await fetch(`https://api.yookassa.ru/v3${path}`, {
		method: init.method,
		headers,
		body: init.body !== undefined ? JSON.stringify(init.body) : undefined
	});
	const text = await res.text();
	let json: unknown = null;
	try {
		json = text ? JSON.parse(text) : null;
	} catch {
		json = { raw: text.slice(0, 400) };
	}
	return { status: res.status, json };
}

export async function createYooKassaCheckout(opts: {
	userId: string;
	email?: string | null;
	plan: ProPlan;
}): Promise<{ url: string; paymentId: string }> {
	const cfg = resolveYooKassaConfig();
	if (!cfg) throw new Error('billing.unavailable');

	const amount = yooKassaAmount(cfg, opts.plan);
	const { status, json } = await yooFetch(cfg, '/payments', {
		method: 'POST',
		idempotenceKey: randomUUID(),
		body: {
			amount: { value: amount, currency: cfg.currency },
			capture: true,
			confirmation: {
				type: 'redirect',
				return_url: billingReturnUrl('success')
			},
			description: `Repdraft Pro (${opts.plan})`,
			metadata: {
				user_id: opts.userId,
				plan: opts.plan,
				product: 'repdraft_pro'
			},
			...(opts.email
				? { receipt: undefined /* optional; shop may require 54-FZ separately */ }
				: {})
		}
	});

	if (status < 200 || status >= 300) {
		throw new Error(`YooKassa payment create failed (${status})`);
	}
	const payment = json as YooPayment;
	const url = payment.confirmation?.confirmation_url;
	if (!payment.id || !url) {
		throw new Error('YooKassa payment missing confirmation_url');
	}
	return { url, paymentId: payment.id };
}

export async function fetchYooKassaPayment(paymentId: string): Promise<YooPayment | null> {
	const cfg = resolveYooKassaConfig();
	if (!cfg) return null;
	const { status, json } = await yooFetch(cfg, `/payments/${encodeURIComponent(paymentId)}`, {
		method: 'GET'
	});
	if (status < 200 || status >= 300) return null;
	return json as YooPayment;
}

export type YooWebhookEvent = {
	type?: string;
	event?: string;
	object?: YooPayment;
};

export function parseYooWebhook(body: unknown): {
	event: string;
	payment: YooPayment;
} | null {
	if (!body || typeof body !== 'object') return null;
	const raw = body as YooWebhookEvent;
	const payment = raw.object;
	const event = raw.event || raw.type || '';
	if (!payment?.id || !event) return null;
	return { event, payment };
}

export function yooPaymentMeta(payment: YooPayment): {
	userId: string | null;
	plan: ProPlan | null;
} {
	const meta = payment.metadata ?? {};
	const userId = typeof meta.user_id === 'string' ? meta.user_id : null;
	const plan = meta.plan === 'monthly' || meta.plan === 'yearly' ? meta.plan : null;
	return { userId, plan };
}
