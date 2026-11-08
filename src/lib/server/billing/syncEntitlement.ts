import type { SupabaseClient } from '@supabase/supabase-js';
import {
	isProActive,
	periodEndIso,
	PRO_APP_META_KEY,
	PRO_PLAN_APP_META_KEY,
	PRO_PROVIDER_APP_META_KEY,
	PRO_STATUS_APP_META_KEY,
	PRO_UNTIL_APP_META_KEY,
	type BillingProvider,
	type EntitlementStatus,
	type ProPlan
} from '$lib/domain/entitlement';

export type EntitlementWrite = {
	userId: string;
	status: Exclude<EntitlementStatus, 'none'>;
	plan: ProPlan;
	provider: BillingProvider;
	providerCustomerId?: string | null;
	providerSubscriptionId?: string | null;
	currentPeriodEnd: string;
};

export async function upsertEntitlement(
	admin: SupabaseClient,
	row: EntitlementWrite
): Promise<void> {
	const { error } = await admin.from('entitlements').upsert(
		{
			user_id: row.userId,
			status: row.status,
			plan: row.plan,
			provider: row.provider,
			provider_customer_id: row.providerCustomerId ?? null,
			provider_subscription_id: row.providerSubscriptionId ?? null,
			current_period_end: row.currentPeriodEnd
		},
		{ onConflict: 'user_id' }
	);
	if (error) {
		throw new Error(`entitlements upsert: ${error.message}`);
	}

	const pro = isProActive({
		status: row.status,
		proUntil: row.currentPeriodEnd
	});

	const { error: metaError } = await admin.auth.admin.updateUserById(row.userId, {
		app_metadata: {
			[PRO_APP_META_KEY]: pro,
			[PRO_UNTIL_APP_META_KEY]: row.currentPeriodEnd,
			[PRO_PLAN_APP_META_KEY]: row.plan,
			[PRO_STATUS_APP_META_KEY]: row.status,
			[PRO_PROVIDER_APP_META_KEY]: row.provider
		}
	});
	if (metaError) {
		throw new Error(`app_metadata sync: ${metaError.message}`);
	}
}

export async function loadEntitlementRow(
	admin: SupabaseClient,
	userId: string
): Promise<{
	status: Exclude<EntitlementStatus, 'none'>;
	plan: ProPlan;
	provider: BillingProvider;
	currentPeriodEnd: string;
	providerCustomerId: string | null;
	providerSubscriptionId: string | null;
} | null> {
	const { data, error } = await admin
		.from('entitlements')
		.select(
			'status, plan, provider, current_period_end, provider_customer_id, provider_subscription_id'
		)
		.eq('user_id', userId)
		.maybeSingle();
	if (error) {
		if (error.code === 'PGRST205' || error.code === '42P01') return null;
		throw new Error(`entitlements select: ${error.message}`);
	}
	if (!data) return null;
	return {
		status: data.status as Exclude<EntitlementStatus, 'none'>,
		plan: data.plan as ProPlan,
		provider: data.provider as BillingProvider,
		currentPeriodEnd: data.current_period_end as string,
		providerCustomerId: (data.provider_customer_id as string | null) ?? null,
		providerSubscriptionId: (data.provider_subscription_id as string | null) ?? null
	};
}

/** Grant period from a successful one-shot payment (YooKassa). */
export function grantPeriodEnd(plan: ProPlan, from: Date = new Date()): string {
	return periodEndIso(plan, from);
}
