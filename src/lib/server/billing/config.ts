import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import type { BillingProvider, ProPlan } from '$lib/domain/entitlement';
import { isBillingProvider, isProPlan } from '$lib/domain/entitlement';

function trim(v: string | undefined): string {
	return (v ?? '').trim();
}

export function siteUrl(): string {
	return (
		trim(publicEnv.PUBLIC_SITE_URL) ||
		trim(publicEnv.PUBLIC_WEB_ORIGIN) ||
		'https://www.repdraft.xyz'
	).replace(/\/$/, '');
}

export function billingReturnUrl(result: 'success' | 'cancel'): string {
	return `${siteUrl()}/auth/pro?billing=${result}`;
}

export function defaultBillingProvider(): BillingProvider {
	const raw = trim(privateEnv.BILLING_DEFAULT_PROVIDER).toLowerCase();
	return isBillingProvider(raw) ? raw : 'yookassa';
}

export type YooKassaConfig = {
	shopId: string;
	secretKey: string;
	amountMonthly: string;
	amountYearly: string;
	currency: string;
};

export function resolveYooKassaConfig(): YooKassaConfig | null {
	const shopId = trim(privateEnv.YOOKASSA_SHOP_ID);
	const secretKey = trim(privateEnv.YOOKASSA_SECRET_KEY);
	if (!shopId || !secretKey) return null;
	return {
		shopId,
		secretKey,
		amountMonthly: trim(privateEnv.YOOKASSA_AMOUNT_MONTHLY) || '149.00',
		amountYearly: trim(privateEnv.YOOKASSA_AMOUNT_YEARLY) || '1490.00',
		currency: trim(privateEnv.YOOKASSA_CURRENCY) || 'RUB'
	};
}

export type StripeConfig = {
	secretKey: string;
	webhookSecret: string;
	priceMonthly: string;
	priceYearly: string;
};

export function resolveStripeConfig(): StripeConfig | null {
	const secretKey = trim(privateEnv.STRIPE_SECRET_KEY);
	const webhookSecret = trim(privateEnv.STRIPE_WEBHOOK_SECRET);
	const priceMonthly = trim(privateEnv.STRIPE_PRICE_MONTHLY);
	const priceYearly = trim(privateEnv.STRIPE_PRICE_YEARLY);
	if (!secretKey || !priceMonthly || !priceYearly) return null;
	return { secretKey, webhookSecret, priceMonthly, priceYearly };
}

export function stripePriceId(cfg: StripeConfig, plan: ProPlan): string {
	return plan === 'monthly' ? cfg.priceMonthly : cfg.priceYearly;
}

export function yooKassaAmount(cfg: YooKassaConfig, plan: ProPlan): string {
	return plan === 'monthly' ? cfg.amountMonthly : cfg.amountYearly;
}

export function billingAvailability(): {
	yookassa: boolean;
	stripe: boolean;
	defaultProvider: BillingProvider;
} {
	return {
		yookassa: resolveYooKassaConfig() !== null,
		stripe: resolveStripeConfig() !== null,
		defaultProvider: defaultBillingProvider()
	};
}

export function resolveCheckoutProvider(
	requested: unknown
): { provider: BillingProvider } | { error: 'unavailable' | 'invalid_provider' } {
	const avail = billingAvailability();
	const preferred = isBillingProvider(requested)
		? requested
		: avail.defaultProvider;

	if (preferred === 'yookassa' && avail.yookassa) return { provider: 'yookassa' };
	if (preferred === 'stripe' && avail.stripe) return { provider: 'stripe' };

	/* Fallback to the other configured provider. */
	if (avail.yookassa) return { provider: 'yookassa' };
	if (avail.stripe) return { provider: 'stripe' };
	return { error: 'unavailable' };
}

export function parseCheckoutPlan(value: unknown): ProPlan | null {
	return isProPlan(value) ? value : null;
}
