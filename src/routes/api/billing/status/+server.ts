import { isProActive, proFromAppMetadata } from '$lib/domain/entitlement';
import { accountCorsHeaders, requireUser } from '$lib/server/auth/requireUser';
import { billingAvailability } from '$lib/server/billing/config';
import { loadEntitlementRow } from '$lib/server/billing/syncEntitlement';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function corsHeaders(request: Request): HeadersInit {
	return accountCorsHeaders(request, 'GET, OPTIONS');
}

function jsonWithCors(request: Request, body: unknown, init?: ResponseInit) {
	const headers = new Headers(init?.headers);
	const cors = corsHeaders(request);
	for (const [k, v] of Object.entries(cors)) headers.set(k, v);
	return json(body, { ...init, headers });
}

export const OPTIONS: RequestHandler = async ({ request }) =>
	new Response(null, { status: 204, headers: corsHeaders(request) });

/** Pro status for web/RN after return from checkout. */
export const GET: RequestHandler = async ({ request }) => {
	const gate = await requireUser(request);
	if (!gate.ok) {
		return jsonWithCors(request, { error: gate.errorKey }, { status: gate.status });
	}

	const fromMeta = proFromAppMetadata(
		gate.user.app_metadata as Record<string, unknown> | undefined
	);
	const avail = billingAvailability();

	try {
		const row = await loadEntitlementRow(gate.admin, gate.user.id);
		if (row) {
			const pro = isProActive({ status: row.status, proUntil: row.currentPeriodEnd });
			const cancelable = pro && row.provider === 'yookassa' && row.status === 'active';
			const manageable = Boolean(
				pro && row.provider === 'stripe' && row.providerCustomerId
			);
			return jsonWithCors(request, {
				pro,
				status: row.status,
				plan: row.plan,
				provider: row.provider,
				currentPeriodEnd: row.currentPeriodEnd,
				managed: true,
				cancelable,
				manageable,
				billing: avail
			});
		}
	} catch (err) {
		console.warn('billing status entitlements', err);
	}

	/* Metadata-only grant (ops): Pro access without a cancelable subscription row. */
	return jsonWithCors(request, {
		pro: fromMeta.pro,
		status: fromMeta.status,
		plan: fromMeta.plan,
		provider: fromMeta.provider,
		currentPeriodEnd: fromMeta.proUntil,
		managed: false,
		cancelable: false,
		manageable: false,
		billing: avail
	});
};
