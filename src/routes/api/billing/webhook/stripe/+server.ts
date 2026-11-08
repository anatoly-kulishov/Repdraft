import { isProPlan, type ProPlan } from '$lib/domain/entitlement';
import { getSupabaseAdmin } from '$lib/server/supabase/admin';
import {
	constructStripeEvent,
	getStripe,
	planFromStripeMetadata
} from '$lib/server/billing/stripeBilling';
import { upsertEntitlement } from '$lib/server/billing/syncEntitlement';
import { json } from '@sveltejs/kit';
import type Stripe from 'stripe';
import type { RequestHandler } from './$types';

function periodEndFromSubscription(sub: Stripe.Subscription): string {
	const end = sub.current_period_end;
	return new Date(end * 1000).toISOString();
}

function statusFromSubscription(
	sub: Stripe.Subscription
): 'active' | 'past_due' | 'canceled' | 'expired' {
	const status = sub.status;
	switch (status) {
		case 'active':
		case 'trialing':
			return 'active';
		case 'past_due':
			return 'past_due';
		case 'canceled':
		case 'unpaid':
			return 'canceled';
		case 'incomplete':
		case 'incomplete_expired':
		case 'paused':
			return 'expired';
		default: {
			const _unused: typeof status = status;
			void _unused;
			return 'expired';
		}
	}
}

async function syncSubscription(
	admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
	sub: Stripe.Subscription,
	fallbackUserId?: string | null,
	fallbackPlan?: ProPlan | null
): Promise<void> {
	const userId =
		(typeof sub.metadata?.user_id === 'string' && sub.metadata.user_id) ||
		fallbackUserId ||
		null;
	const plan =
		planFromStripeMetadata(sub.metadata) ||
		fallbackPlan ||
		null;
	if (!userId || !plan || !isProPlan(plan)) {
		console.error('stripe webhook: missing user/plan', sub.id);
		return;
	}

	const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? null;

	await upsertEntitlement(admin, {
		userId,
		status: statusFromSubscription(sub),
		plan,
		provider: 'stripe',
		providerCustomerId: customerId,
		providerSubscriptionId: sub.id,
		currentPeriodEnd: periodEndFromSubscription(sub)
	});
}

export const POST: RequestHandler = async ({ request }) => {
	const admin = getSupabaseAdmin();
	const gate = getStripe();
	if (!admin || !gate) {
		return json({ error: 'unavailable' }, { status: 503 });
	}

	const signature = request.headers.get('stripe-signature');
	if (!signature) {
		return json({ error: 'missing_signature' }, { status: 400 });
	}

	const rawBody = await request.text();
	let event: Stripe.Event;
	try {
		event = constructStripeEvent(rawBody, signature);
	} catch (err) {
		console.error('stripe webhook signature', err);
		return json({ error: 'invalid_signature' }, { status: 400 });
	}

	try {
		switch (event.type) {
			case 'checkout.session.completed': {
				const session = event.data.object as Stripe.Checkout.Session;
				if (session.mode !== 'subscription' || !session.subscription) break;
				const subId =
					typeof session.subscription === 'string'
						? session.subscription
						: session.subscription.id;
				const sub = await gate.stripe.subscriptions.retrieve(subId);
				const userId =
					session.client_reference_id ||
					(typeof session.metadata?.user_id === 'string' ? session.metadata.user_id : null);
				const plan = planFromStripeMetadata(session.metadata);
				await syncSubscription(admin, sub, userId, plan);
				break;
			}
			case 'customer.subscription.updated':
			case 'customer.subscription.deleted': {
				const sub = event.data.object as Stripe.Subscription;
				await syncSubscription(admin, sub);
				break;
			}
			case 'invoice.paid':
			case 'invoice.payment_failed': {
				const invoice = event.data.object as Stripe.Invoice;
				const subRef = invoice.subscription;
				if (!subRef) break;
				const subId = typeof subRef === 'string' ? subRef : subRef.id;
				const sub = await gate.stripe.subscriptions.retrieve(subId);
				await syncSubscription(admin, sub);
				break;
			}
			default:
				break;
		}
	} catch (err) {
		console.error('stripe webhook handler', event.type, err);
		return json({ error: 'sync_failed' }, { status: 500 });
	}

	return json({ ok: true });
};
