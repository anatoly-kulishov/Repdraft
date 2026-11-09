<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import AppButton from '$lib/components/AppButton.svelte';
	import IconPlate from '$lib/components/IconPlate.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import {
		proFromAppMetadata,
		type BillingProvider,
		type EntitlementStatus,
		type ProPlan
	} from '$lib/domain/entitlement';
	import { formatShortDate } from '$lib/i18n/format';
	import { translate, translateError } from '$lib/i18n/messages';
	import { auth } from '$lib/stores/auth';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';
	import { getSupabase } from '$lib/supabase/client';
	import { Camera, CrownSimple, Info } from 'phosphor-svelte';
	import { onMount } from 'svelte';

	let lang = $derived($resolvedLocale);
	let user = $derived($auth.user);
	let snap = $derived(
		proFromAppMetadata(user?.app_metadata as Record<string, unknown> | undefined)
	);

	let busyPlan = $state<ProPlan | null>(null);
	let portalBusy = $state(false);
	/** null = probing checkout availability; avoid flashing «unavailable». */
	let billingReady = $state<boolean | null>(null);
	let providers = $state<{ yookassa: boolean; stripe: boolean; defaultProvider: BillingProvider }>({
		yookassa: false,
		stripe: false,
		defaultProvider: 'yookassa'
	});
	let statusPeriodEnd = $state<string | null>(null);
	/** null until /api/billing/status returns; prefer over stale app_metadata. */
	let remotePro = $state<boolean | null>(null);
	let remoteStatus = $state<EntitlementStatus | null>(null);
	let remoteProvider = $state<BillingProvider | null>(null);
	let cancelable = $state(false);
	let manageable = $state(false);

	let effectivePro = $derived(remotePro ?? snap.pro);
	let periodLabel = $derived.by(() => {
		const until = statusPeriodEnd || snap.proUntil;
		if (!until) return translate(lang, 'billing.active');
		const d = new Date(until);
		if (!Number.isFinite(d.getTime())) return translate(lang, 'billing.active');
		return translate(lang, 'billing.activeUntil', {
			date: formatShortDate(until, lang)
		});
	});

	async function refreshStatus(): Promise<boolean> {
		const supabase = getSupabase();
		if (!supabase) return false;
		try {
			await supabase.auth.refreshSession();
		} catch {
			/* ignore */
		}
		const {
			data: { session }
		} = await supabase.auth.getSession();
		const token = session?.access_token;
		if (!token) return false;

		const res = await fetch('/api/billing/status', {
			headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
		});
		if (!res.ok) return false;
		const body = (await res.json()) as {
			pro?: boolean;
			status?: string | null;
			provider?: string | null;
			currentPeriodEnd?: string | null;
			cancelable?: boolean;
			manageable?: boolean;
			billing?: { yookassa?: boolean; stripe?: boolean; defaultProvider?: BillingProvider };
		};
		if (typeof body.pro === 'boolean') remotePro = body.pro;
		if (body.currentPeriodEnd) statusPeriodEnd = body.currentPeriodEnd;
		else if (body.pro === false) statusPeriodEnd = null;
		if (
			body.status === 'active' ||
			body.status === 'past_due' ||
			body.status === 'canceled' ||
			body.status === 'expired' ||
			body.status === 'none'
		) {
			remoteStatus = body.status;
		}
		if (body.provider === 'yookassa' || body.provider === 'stripe') {
			remoteProvider = body.provider;
		} else {
			remoteProvider = null;
		}
		cancelable = Boolean(body.cancelable);
		manageable = Boolean(body.manageable);
		if (body.billing) {
			providers = {
				yookassa: Boolean(body.billing.yookassa),
				stripe: Boolean(body.billing.stripe),
				defaultProvider: body.billing.defaultProvider === 'stripe' ? 'stripe' : 'yookassa'
			};
			billingReady = providers.yookassa || providers.stripe;
		}
		return body.pro === true;
	}

	/** Webhook can lag behind return_url; poll until Pro shows or attempts run out. */
	async function refreshStatusUntilPro(attempts = 6) {
		for (let i = 0; i < attempts; i++) {
			const ok = await refreshStatus();
			if (ok) return;
			await new Promise((r) => setTimeout(r, 700));
		}
	}

	async function loadAvailability() {
		try {
			const res = await fetch('/api/billing/checkout', { headers: { Accept: 'application/json' } });
			if (!res.ok) {
				billingReady = false;
				return;
			}
			const body = (await res.json()) as {
				available?: boolean;
				yookassa?: boolean;
				stripe?: boolean;
				defaultProvider?: BillingProvider;
			};
			providers = {
				yookassa: Boolean(body.yookassa),
				stripe: Boolean(body.stripe),
				defaultProvider: body.defaultProvider === 'stripe' ? 'stripe' : 'yookassa'
			};
			billingReady = Boolean(body.available);
		} catch {
			billingReady = false;
		}
	}

	async function startCheckout(plan: ProPlan) {
		if (!user) {
			toasts.show(translate(lang, 'billing.needAuth'), 'error');
			return;
		}
		const supabase = getSupabase();
		if (!supabase) {
			toasts.show(translate(lang, 'billing.unavailable'), 'error');
			return;
		}
		busyPlan = plan;
		try {
			const {
				data: { session }
			} = await supabase.auth.getSession();
			const token = session?.access_token;
			if (!token) throw new Error('errors.needAuth');

			const res = await fetch('/api/billing/checkout', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/json',
					Accept: 'application/json'
				},
				body: JSON.stringify({ plan, provider: providers.defaultProvider })
			});
			const body = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
			if (!res.ok || !body?.url) {
				throw new Error(body?.error ?? 'billing.checkoutFail');
			}
			window.location.assign(body.url);
		} catch (err) {
			toasts.show(translateError(lang, err, 'billing.checkoutFail'), 'error');
		} finally {
			busyPlan = null;
		}
	}

	async function openPortal() {
		const supabase = getSupabase();
		if (!supabase || !user) return;
		portalBusy = true;
		try {
			const {
				data: { session }
			} = await supabase.auth.getSession();
			const token = session?.access_token;
			if (!token) throw new Error('errors.needAuth');

			const provider = remoteProvider ?? snap.provider;
			const action = provider === 'yookassa' ? 'cancel' : 'manage';
			const res = await fetch('/api/billing/portal', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/json',
					Accept: 'application/json'
				},
				body: JSON.stringify({ action })
			});
			const body = (await res.json().catch(() => null)) as {
				url?: string;
				ok?: boolean;
				error?: string;
			} | null;
			if (!res.ok) {
				await refreshStatus();
				throw new Error(body?.error ?? 'billing.portalFail');
			}
			if (body?.url) {
				window.location.assign(body.url);
				return;
			}
			if (body?.ok) {
				toasts.show(translate(lang, 'billing.cancelDone'), 'success');
				await refreshStatus();
			}
		} catch (err) {
			toasts.show(translateError(lang, err, 'billing.portalFail'), 'error');
		} finally {
			portalBusy = false;
		}
	}

	onMount(() => {
		if (!browser || !user) return;
		void loadAvailability();
		void refreshStatus();

		const flag = $page.url.searchParams.get('billing');
		if (flag === 'success' || flag === 'portal') {
			toasts.show(translate(lang, 'billing.success'), 'success');
			void refreshStatusUntilPro();
		} else if (flag === 'cancel') {
			toasts.show(translate(lang, 'billing.cancelled'), 'info');
		}
		if (flag) {
			const url = new URL($page.url);
			url.searchParams.delete('billing');
			history.replaceState({}, '', `${url.pathname}${url.search}`);
		}
	});
</script>

{#if user}
	<section id="pro" class="billing-card panel text-left" aria-labelledby="billing-pro-title">
		<header class="billing-card__head">
			<IconPlate icon={CrownSimple} tone="accent" weight="fill" />
			<div class="billing-card__head-text">
				<div class="billing-card__title-row">
					<h2 id="billing-pro-title" class="billing-card__title">
						{translate(lang, 'billing.title')}
					</h2>
					{#if effectivePro}
						<span class="billing-card__badge">{translate(lang, 'billing.activeBadge')}</span>
					{/if}
				</div>
				<p class="billing-card__lead">
					{effectivePro ? periodLabel : translate(lang, 'billing.lead')}
				</p>
			</div>
		</header>

		<div class="billing-card__feature">
			<IconPlate icon={Camera} tone="accent" />
			<p class="billing-card__feature-text">{translate(lang, 'billing.benefitRecognize')}</p>
		</div>

		{#if effectivePro}
			{#if manageable}
				<AppButton
					variant="secondary"
					block
					class="min-h-[48px]"
					disabled={portalBusy}
					onclick={() => void openPortal()}
				>
					{portalBusy ? '…' : translate(lang, 'billing.manage')}
				</AppButton>
			{:else if cancelable}
				<AppButton
					variant="ghost"
					block
					class="min-h-[48px]"
					disabled={portalBusy}
					onclick={() => void openPortal()}
				>
					{portalBusy ? '…' : translate(lang, 'billing.cancel')}
				</AppButton>
			{:else if remoteStatus === 'canceled'}
				<p class="billing-card__note" role="status">
					<LucideIcon icon={Info} size={ICON_SMALL} class="billing-card__note-icon" />
					<span>{translate(lang, 'billing.cancelDone')}</span>
				</p>
			{/if}
		{:else if billingReady === null}
			<p class="billing-card__status" aria-live="polite">{translate(lang, 'billing.checking')}</p>
		{:else if !billingReady}
			<p class="billing-card__note" role="status">
				<LucideIcon icon={Info} size={ICON_SMALL} class="billing-card__note-icon" />
				<span>{translate(lang, 'billing.unavailable')}</span>
			</p>
		{:else}
			<div class="billing-card__actions">
				<AppButton
					variant="primary"
					block
					class="min-h-[48px]"
					disabled={busyPlan !== null}
					onclick={() => void startCheckout('monthly')}
				>
					{busyPlan === 'monthly' ? '…' : translate(lang, 'billing.planMonthly')}
				</AppButton>
				<AppButton
					variant="secondary"
					block
					class="min-h-[48px]"
					disabled={busyPlan !== null}
					onclick={() => void startCheckout('yearly')}
				>
					{busyPlan === 'yearly' ? '…' : translate(lang, 'billing.planYearly')}
				</AppButton>
			</div>
		{/if}
	</section>
{/if}

<style>
	.billing-card {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		padding: 1rem 1.05rem 1.05rem 1.15rem;
		overflow: hidden;
		border-color: var(--color-border);
		background:
			linear-gradient(
				180deg,
				color-mix(in srgb, var(--color-accent) 7%, var(--color-panel, var(--color-surface))) 0%,
				var(--color-panel, var(--color-surface)) 42%
			);
	}

	.billing-card::before {
		content: '';
		position: absolute;
		inset: 0 auto 0 0;
		width: 3px;
		background: color-mix(in srgb, var(--color-accent) 72%, transparent);
		border-radius: inherit 0 0 inherit;
		pointer-events: none;
	}

	.billing-card__head {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
	}

	.billing-card__head-text {
		min-width: 0;
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.billing-card__title-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.4rem 0.55rem;
	}

	.billing-card__title {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 700;
		letter-spacing: -0.01em;
		color: var(--color-text);
		line-height: 1.25;
	}

	.billing-card__badge {
		display: inline-flex;
		align-items: center;
		min-height: 1.5rem;
		padding: 0.1rem 0.55rem;
		border-radius: 999px;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		color: var(--color-accent-ink, #fff);
		background: var(--color-accent-fill, var(--color-accent));
	}

	.billing-card__lead {
		margin: 0;
		font-size: 0.875rem;
		line-height: 1.4;
		color: var(--color-muted);
	}

	.billing-card__feature {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-height: 48px;
		padding: 0.85rem 0 0;
		border-top: 1px solid color-mix(in srgb, var(--color-border) 85%, transparent);
	}

	.billing-card__feature-text {
		margin: 0;
		font-size: 0.9375rem;
		font-weight: 600;
		line-height: 1.35;
		color: var(--color-text);
	}

	.billing-card__actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}

	@media (max-width: 380px) {
		.billing-card__actions {
			grid-template-columns: 1fr;
		}
	}

	.billing-card__status {
		margin: 0;
		font-size: 0.8125rem;
		line-height: 1.35;
		color: var(--color-muted);
	}

	.billing-card__note {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		margin: 0;
		min-height: 48px;
		padding: 0.55rem 0.75rem;
		border-radius: 0.75rem;
		border: 1px dashed color-mix(in srgb, var(--color-border) 90%, transparent);
		background: color-mix(in srgb, var(--color-surface-muted, #888) 10%, transparent);
		font-size: 0.8125rem;
		line-height: 1.35;
		color: var(--color-muted);
	}

	.billing-card__note :global(.billing-card__note-icon) {
		flex-shrink: 0;
		color: var(--color-muted);
	}
</style>
