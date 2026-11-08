import { getSupabaseAdmin } from '$lib/server/supabase/admin';
import { grantPeriodEnd, upsertEntitlement } from '$lib/server/billing/syncEntitlement';
import { parseYooWebhook, yooPaymentMeta } from '$lib/server/billing/yookassa';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * YooKassa notification endpoint.
 * Configure URL in YooKassa cabinet → HTTP notifications.
 */
export const POST: RequestHandler = async ({ request }) => {
	const admin = getSupabaseAdmin();
	if (!admin) {
		return json({ error: 'unavailable' }, { status: 503 });
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'invalid' }, { status: 400 });
	}

	const parsed = parseYooWebhook(body);
	if (!parsed) {
		return json({ error: 'invalid' }, { status: 400 });
	}

	const { event, payment } = parsed;
	/* Ignore non-success events quickly with 200 so YooKassa stops retrying. */
	if (event !== 'payment.succeeded' && payment.status !== 'succeeded') {
		return json({ ok: true, ignored: event });
	}

	const { userId, plan } = yooPaymentMeta(payment);
	if (!userId || !plan) {
		console.error('yookassa webhook: missing metadata', payment.id);
		return json({ error: 'missing_metadata' }, { status: 400 });
	}

	try {
		await upsertEntitlement(admin, {
			userId,
			status: 'active',
			plan,
			provider: 'yookassa',
			providerCustomerId: null,
			providerSubscriptionId: payment.id,
			currentPeriodEnd: grantPeriodEnd(plan)
		});
	} catch (err) {
		console.error('yookassa webhook upsert', err);
		return json({ error: 'sync_failed' }, { status: 500 });
	}

	return json({ ok: true });
};
