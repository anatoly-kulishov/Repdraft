/** Pro entitlement: mirror of app_metadata + entitlements table. Pure, no fetch. */

export type ProPlan = 'monthly' | 'yearly';
export type BillingProvider = 'yookassa' | 'stripe';
export type EntitlementStatus = 'none' | 'active' | 'past_due' | 'canceled' | 'expired';

/** app_metadata keys written by billing webhooks. */
export const PRO_APP_META_KEY = 'pro';
export const PRO_UNTIL_APP_META_KEY = 'pro_until';
export const PRO_PLAN_APP_META_KEY = 'pro_plan';
export const PRO_STATUS_APP_META_KEY = 'pro_status';
export const PRO_PROVIDER_APP_META_KEY = 'pro_provider';

export type ProSnapshot = {
	pro: boolean;
	status: EntitlementStatus;
	plan: ProPlan | null;
	proUntil: string | null;
	provider: BillingProvider | null;
};

export function isProPlan(value: unknown): value is ProPlan {
	return value === 'monthly' || value === 'yearly';
}

export function isBillingProvider(value: unknown): value is BillingProvider {
	return value === 'yookassa' || value === 'stripe';
}

export function isEntitlementStatus(value: unknown): value is Exclude<EntitlementStatus, 'none'> {
	return (
		value === 'active' || value === 'past_due' || value === 'canceled' || value === 'expired'
	);
}

/** End of paid period from start (UTC month/year roll). */
export function periodEndIso(plan: ProPlan, from: Date = new Date()): string {
	const d = new Date(from.getTime());
	if (plan === 'monthly') {
		d.setUTCMonth(d.getUTCMonth() + 1);
	} else {
		d.setUTCFullYear(d.getUTCFullYear() + 1);
	}
	return d.toISOString();
}

/**
 * Stack a new paid period onto an existing one (renew / second YooKassa payment).
 * If current period is still open, extend from its end; otherwise from `from`.
 */
export function stackPeriodEnd(
	plan: ProPlan,
	existingEnd: string | null | undefined,
	from: Date = new Date()
): string {
	const existingMs =
		typeof existingEnd === 'string' && existingEnd.trim() ? Date.parse(existingEnd) : Number.NaN;
	const start =
		Number.isFinite(existingMs) && existingMs > from.getTime() ? new Date(existingMs) : from;
	return periodEndIso(plan, start);
}

/**
 * True when the user should get Pro features.
 * `past_due` still counts until `proUntil` (grace).
 */
export function isProActive(input: {
	status?: string | null;
	proUntil?: string | null;
	now?: () => Date;
}): boolean {
	const nowMs = (input.now ?? (() => new Date()))().getTime();
	const status = (input.status ?? '').toLowerCase();
	const untilMs =
		typeof input.proUntil === 'string' && input.proUntil.trim()
			? Date.parse(input.proUntil)
			: Number.NaN;

	if (status === 'active' || status === 'past_due') {
		if (!Number.isFinite(untilMs)) return status === 'active';
		return untilMs > nowMs;
	}

	if (status === 'canceled') {
		return Number.isFinite(untilMs) && untilMs > nowMs;
	}

	/* Manual grant: pro_until alone (e.g. ops) without status. */
	if (!status || status === 'none') {
		return Number.isFinite(untilMs) && untilMs > nowMs;
	}

	return false;
}

function readMetaString(meta: Record<string, unknown> | null | undefined, key: string): string | null {
	if (!meta) return null;
	const v = meta[key];
	if (typeof v === 'string' && v.trim()) return v.trim();
	if (typeof v === 'boolean') return v ? 'true' : 'false';
	return null;
}

/** Parse Pro fields from Supabase `user.app_metadata`. */
export function proFromAppMetadata(
	meta: Record<string, unknown> | null | undefined,
	now?: () => Date
): ProSnapshot {
	const statusRaw = readMetaString(meta, PRO_STATUS_APP_META_KEY)?.toLowerCase() ?? '';
	const status: EntitlementStatus = isEntitlementStatus(statusRaw) ? statusRaw : 'none';
	const planRaw = readMetaString(meta, PRO_PLAN_APP_META_KEY);
	const plan = isProPlan(planRaw) ? planRaw : null;
	const providerRaw = readMetaString(meta, PRO_PROVIDER_APP_META_KEY);
	const provider = isBillingProvider(providerRaw) ? providerRaw : null;
	const proUntil = readMetaString(meta, PRO_UNTIL_APP_META_KEY);

	const flag = meta?.[PRO_APP_META_KEY];
	const flagged =
		flag === true || flag === 'true' || flag === 1 || flag === '1' || status === 'active';

	const pro = isProActive({
		status: flagged && status === 'none' ? 'active' : status,
		proUntil,
		now
	});

	return { pro, status: pro && status === 'none' ? 'active' : status, plan, proUntil, provider };
}

export function runEntitlementSelfCheck(): void {
	const now = () => new Date('2026-06-01T12:00:00.000Z');
	if (
		!isProActive({
			status: 'active',
			proUntil: '2026-07-01T00:00:00.000Z',
			now
		})
	) {
		throw new Error('isProActive active+future');
	}
	if (
		isProActive({
			status: 'active',
			proUntil: '2026-05-01T00:00:00.000Z',
			now
		})
	) {
		throw new Error('isProActive active+past should be false');
	}
	if (
		!isProActive({
			status: 'canceled',
			proUntil: '2026-07-01T00:00:00.000Z',
			now
		})
	) {
		throw new Error('isProActive canceled until period end');
	}
	if (!isProActive({ proUntil: '2026-07-01T00:00:00.000Z', now })) {
		throw new Error('isProActive until-only grant');
	}
	const snap = proFromAppMetadata(
		{
			pro: true,
			pro_status: 'active',
			pro_until: '2026-07-01T00:00:00.000Z',
			pro_plan: 'monthly',
			pro_provider: 'yookassa'
		},
		now
	);
	if (!snap.pro || snap.plan !== 'monthly' || snap.provider !== 'yookassa') {
		throw new Error('proFromAppMetadata mismatch');
	}
	const end = periodEndIso('monthly', new Date('2026-01-15T00:00:00.000Z'));
	if (!end.startsWith('2026-02-15')) {
		throw new Error(`periodEndIso monthly got ${end}`);
	}
	const stacked = stackPeriodEnd(
		'monthly',
		'2026-07-01T00:00:00.000Z',
		new Date('2026-06-01T12:00:00.000Z')
	);
	if (!stacked.startsWith('2026-08-01')) {
		throw new Error(`stackPeriodEnd open period got ${stacked}`);
	}
	const stackedFresh = stackPeriodEnd(
		'monthly',
		'2026-05-01T00:00:00.000Z',
		new Date('2026-06-01T12:00:00.000Z')
	);
	if (!stackedFresh.startsWith('2026-07-01')) {
		throw new Error(`stackPeriodEnd expired period got ${stackedFresh}`);
	}
}
