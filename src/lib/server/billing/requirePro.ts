import { isProActive, proFromAppMetadata } from '$lib/domain/entitlement';
import type { User } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadEntitlementRow } from './syncEntitlement';

/**
 * Server gate for Pro-only routes (e.g. recognize-plan).
 * Prefers entitlements row; falls back to app_metadata mirror.
 */
export async function userHasPro(admin: SupabaseClient, user: User): Promise<boolean> {
	try {
		const row = await loadEntitlementRow(admin, user.id);
		if (row) {
			return isProActive({ status: row.status, proUntil: row.currentPeriodEnd });
		}
	} catch {
		/* table missing or transient — fall through to metadata */
	}
	const snap = proFromAppMetadata(user.app_metadata as Record<string, unknown> | undefined);
	return snap.pro;
}
