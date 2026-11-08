import { getSupabaseAdmin } from '$lib/server/supabase/admin';
import { resolveYooKassaConfig, yooKassaAmount } from '$lib/server/billing/config';
import { grantPeriodEnd, upsertEntitlement } from '$lib/server/billing/syncEntitlement';
import {
	fetchYooKassaPayment,
	parseYooWebhook,
	yooPaymentMeta
} from '$lib/server/billing/yookassa';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * YooKassa notification endpoint.
 * Never trust the POST body alone: re-fetch the payment with shop credentials.
 * Configure URL in YooKassa cabinet → HTTP notifications.
 */
export const POST: RequestHandler = async ({ request }) => {
	const admin = getSupabaseAdmin();
	const cfg = resolveYooKassaConfig();
	if (!admin || !cfg) {
		return json({ error: 'unavailable' }, { status: 503 });
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'invalid' }, { status: 400 });
	}

	const parsed = parseYooWebhook(body);
	if (!parsed?.payment.id) {
		return json({ error: 'invalid' }, { status: 400 });
	}

	/* Ignore non-success events quickly with 200 so YooKassa stops retrying. */
	if (parsed.event !== 'payment.succeeded' && parsed.payment.status !== 'succeeded') {
		return json({ ok: true, ignored: parsed.event });
	}

	const verified = await fetchYooKassaPayment(parsed.payment.id);
	if (!verified) {
		console.error('yookassa webhook: payment fetch failed', parsed.payment.id);
		return json({ error: 'verify_failed' }, { status: 502 });
	}

	if (verified.status !== 'succeeded' || verified.paid !== true) {
		return json({ ok: true, ignored: 'not_paid', status: verified.status });
	}

	const { userId, plan } = yooPaymentMeta(verified);
	if (!userId || !plan) {
		console.error('yookassa webhook: missing metadata', verified.id);
		return json({ error: 'missing_metadata' }, { status: 400 });
	}

	const expectedAmount = yooKassaAmount(cfg, plan);
	const paidAmount = verified.amount?.value;
	const paidCurrency = (verified.amount?.currency || '').toUpperCase();
	if (
		!paidAmount ||
		paidAmount !== expectedAmount ||
		(paidCurrency && paidCurrency !== cfg.currency.toUpperCase())
	) {
		console.error('yookassa webhook: amount mismatch', {
			id: verified.id,
			paidAmount,
			expectedAmount,
			paidCurrency,
			currency: cfg.currency
		});
		return json({ error: 'amount_mismatch' }, { status: 400 });
	}

	try {
		await upsertEntitlement(admin, {
			userId,
			status: 'active',
			plan,
			provider: 'yookassa',
			providerCustomerId: null,
			providerSubscriptionId: verified.id,
			currentPeriodEnd: grantPeriodEnd(plan)
		});
	} catch (err) {
		console.error('yookassa webhook upsert', err);
		return json({ error: 'sync_failed' }, { status: 500 });
	}

	return json({ ok: true });
};
