import Stripe from 'stripe';
import type { ProPlan } from '$lib/domain/entitlement';
import {
	billingReturnUrl,
	resolveStripeConfig,
	stripePriceId,
	type StripeConfig
} from './config';

function stripeClient(cfg: StripeConfig): Stripe {
	return new Stripe(cfg.secretKey, {
		apiVersion: '2025-02-24.acacia'
	});
}

export function getStripe(): { cfg: StripeConfig; stripe: Stripe } | null {
	const cfg = resolveStripeConfig();
	if (!cfg) return null;
	return { cfg, stripe: stripeClient(cfg) };
}

export async function createStripeCheckout(opts: {
	userId: string;
	email?: string | null;
	plan: ProPlan;
	customerId?: string | null;
}): Promise<{ url: string; sessionId: string }> {
	const gate = getStripe();
	if (!gate) throw new Error('billing.unavailable');
	const { cfg, stripe } = gate;

	const session = await stripe.checkout.sessions.create({
		mode: 'subscription',
		customer: opts.customerId || undefined,
		customer_email: opts.customerId ? undefined : opts.email || undefined,
		client_reference_id: opts.userId,
		line_items: [{ price: stripePriceId(cfg, opts.plan), quantity: 1 }],
		success_url: billingReturnUrl('success'),
		cancel_url: billingReturnUrl('cancel'),
		metadata: {
			user_id: opts.userId,
			plan: opts.plan,
			product: 'repdraft_pro'
		},
		subscription_data: {
			metadata: {
				user_id: opts.userId,
				plan: opts.plan,
				product: 'repdraft_pro'
			}
		}
	});

	if (!session.url) throw new Error('Stripe Checkout missing url');
	return { url: session.url, sessionId: session.id };
}

export async function createStripePortal(opts: {
	customerId: string;
}): Promise<{ url: string }> {
	const gate = getStripe();
	if (!gate) throw new Error('billing.unavailable');
	const session = await gate.stripe.billingPortal.sessions.create({
		customer: opts.customerId,
		return_url: `${billingReturnUrl('success').replace('billing=success', 'billing=portal')}`
	});
	return { url: session.url };
}

export function constructStripeEvent(
	rawBody: string,
	signature: string
): Stripe.Event {
	const gate = getStripe();
	if (!gate?.cfg.webhookSecret) {
		throw new Error('Stripe webhook secret missing');
	}
	return gate.stripe.webhooks.constructEvent(rawBody, signature, gate.cfg.webhookSecret);
}

export function planFromStripeMetadata(
	meta: Stripe.Metadata | null | undefined
): ProPlan | null {
	const plan = meta?.plan;
	return plan === 'monthly' || plan === 'yearly' ? plan : null;
}
