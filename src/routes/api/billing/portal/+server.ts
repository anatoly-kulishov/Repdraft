import { accountCorsHeaders, requireUser } from '$lib/server/auth/requireUser';
import { siteUrl } from '$lib/server/billing/config';
import { createStripePortal } from '$lib/server/billing/stripeBilling';
import { loadEntitlementRow, upsertEntitlement } from '$lib/server/billing/syncEntitlement';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function corsHeaders(request: Request): HeadersInit {
	return accountCorsHeaders(request, 'POST, OPTIONS');
}

function jsonWithCors(request: Request, body: unknown, init?: ResponseInit) {
	const headers = new Headers(init?.headers);
	const cors = corsHeaders(request);
	for (const [k, v] of Object.entries(cors)) headers.set(k, v);
	return json(body, { ...init, headers });
}

export const OPTIONS: RequestHandler = async ({ request }) =>
	new Response(null, { status: 204, headers: corsHeaders(request) });

/**
 * Stripe → Billing Portal URL.
 * YooKassa (one-shot) → cancel_at_period_end style: mark canceled, keep access until period end.
 */
export const POST: RequestHandler = async ({ request }) => {
	const gate = await requireUser(request);
	if (!gate.ok) {
		return jsonWithCors(request, { error: gate.errorKey }, { status: gate.status });
	}

	let action: 'manage' | 'cancel' = 'manage';
	try {
		const body = (await request.json()) as { action?: unknown };
		if (body.action === 'cancel') action = 'cancel';
	} catch {
		/* empty body = manage */
	}

	const row = await loadEntitlementRow(gate.admin, gate.user.id).catch(() => null);
	if (!row) {
		return jsonWithCors(request, { error: 'billing.noSubscription' }, { status: 404 });
	}

	try {
		if (row.provider === 'stripe') {
			if (!row.providerCustomerId) {
				return jsonWithCors(request, { error: 'billing.noSubscription' }, { status: 404 });
			}
			const { url } = await createStripePortal({ customerId: row.providerCustomerId });
			return jsonWithCors(request, { url, provider: 'stripe' });
		}

		if (action === 'cancel') {
			await upsertEntitlement(gate.admin, {
				userId: gate.user.id,
				status: 'canceled',
				plan: row.plan,
				provider: row.provider,
				providerCustomerId: row.providerCustomerId,
				providerSubscriptionId: row.providerSubscriptionId,
				currentPeriodEnd: row.currentPeriodEnd
			});
			return jsonWithCors(request, {
				ok: true,
				provider: 'yookassa',
				currentPeriodEnd: row.currentPeriodEnd
			});
		}

		return jsonWithCors(request, {
			url: `${siteUrl()}/auth#pro`,
			provider: 'yookassa',
			currentPeriodEnd: row.currentPeriodEnd
		});
	} catch (err) {
		console.error('billing portal', err);
		return jsonWithCors(request, { error: 'billing.portalFail' }, { status: 502 });
	}
};
