import { accountCorsHeaders, requireUser } from '$lib/server/auth/requireUser';
import {
	billingAvailability,
	parseCheckoutPlan,
	resolveCheckoutProvider
} from '$lib/server/billing/config';
import { createStripeCheckout } from '$lib/server/billing/stripeBilling';
import { loadEntitlementRow } from '$lib/server/billing/syncEntitlement';
import { createYooKassaCheckout } from '$lib/server/billing/yookassa';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function corsHeaders(request: Request): HeadersInit {
	return accountCorsHeaders(request, 'GET, POST, OPTIONS');
}

function jsonWithCors(request: Request, body: unknown, init?: ResponseInit) {
	const headers = new Headers(init?.headers);
	const cors = corsHeaders(request);
	for (const [k, v] of Object.entries(cors)) headers.set(k, v);
	return json(body, { ...init, headers });
}

export const OPTIONS: RequestHandler = async ({ request }) =>
	new Response(null, { status: 204, headers: corsHeaders(request) });

/** Availability probe for Profile UI. */
export const GET: RequestHandler = async ({ request }) => {
	const avail = billingAvailability();
	return jsonWithCors(request, {
		available: avail.yookassa || avail.stripe,
		...avail
	});
};

/** Start YooKassa payment or Stripe Checkout Session. */
export const POST: RequestHandler = async ({ request }) => {
	const gate = await requireUser(request);
	if (!gate.ok) {
		return jsonWithCors(request, { error: gate.errorKey }, { status: gate.status });
	}

	let body: { plan?: unknown; provider?: unknown } = {};
	try {
		body = (await request.json()) as { plan?: unknown; provider?: unknown };
	} catch {
		return jsonWithCors(request, { error: 'billing.invalidPlan' }, { status: 400 });
	}

	const plan = parseCheckoutPlan(body.plan);
	if (!plan) {
		return jsonWithCors(request, { error: 'billing.invalidPlan' }, { status: 400 });
	}

	const resolved = resolveCheckoutProvider(body.provider);
	if ('error' in resolved) {
		return jsonWithCors(request, { error: 'billing.unavailable' }, { status: 503 });
	}

	const email = gate.user.email ?? null;
	try {
		if (resolved.provider === 'yookassa') {
			const { url, paymentId } = await createYooKassaCheckout({
				userId: gate.user.id,
				email,
				plan
			});
			return jsonWithCors(request, { url, provider: 'yookassa', id: paymentId });
		}

		const existing = await loadEntitlementRow(gate.admin, gate.user.id).catch(() => null);
		const { url, sessionId } = await createStripeCheckout({
			userId: gate.user.id,
			email,
			plan,
			customerId: existing?.provider === 'stripe' ? existing.providerCustomerId : null
		});
		return jsonWithCors(request, { url, provider: 'stripe', id: sessionId });
	} catch (err) {
		console.error('billing checkout', err);
		return jsonWithCors(request, { error: 'billing.checkoutFail' }, { status: 502 });
	}
};
