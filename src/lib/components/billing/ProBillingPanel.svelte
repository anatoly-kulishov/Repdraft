<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import AppButton from '$lib/components/AppButton.svelte';
	import IconPlate from '$lib/components/IconPlate.svelte';
	import {
		proFromAppMetadata,
		type BillingProvider,
		type ProPlan
	} from '$lib/domain/entitlement';
	import { formatShortDate } from '$lib/i18n/format';
	import { translate, translateError } from '$lib/i18n/messages';
	import { auth } from '$lib/stores/auth';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';
	import { getSupabase } from '$lib/supabase/client';
	import { Camera, CrownSimple } from 'phosphor-svelte';
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

	let periodLabel = $derived.by(() => {
		const until = statusPeriodEnd || snap.proUntil;
		if (!until) return translate(lang, 'billing.active');
		const d = new Date(until);
		if (!Number.isFinite(d.getTime())) return translate(lang, 'billing.active');
		return translate(lang, 'billing.activeUntil', {
			date: formatShortDate(until, lang)
		});
	});

	async function refreshStatus() {
		const supabase = getSupabase();
		if (!supabase) return;
		try {
			await supabase.auth.refreshSession();
		} catch {
			/* ignore */
		}
		const {
			data: { session }
		} = await supabase.auth.getSession();
		const token = session?.access_token;
		if (!token) return;

		const res = await fetch('/api/billing/status', {
			headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
		});
		if (!res.ok) return;
		const body = (await res.json()) as {
			pro?: boolean;
			currentPeriodEnd?: string | null;
			billing?: { yookassa?: boolean; stripe?: boolean; defaultProvider?: BillingProvider };
		};
		if (body.currentPeriodEnd) statusPeriodEnd = body.currentPeriodEnd;
		if (body.billing) {
			providers = {
				yookassa: Boolean(body.billing.yookassa),
				stripe: Boolean(body.billing.stripe),
				defaultProvider: body.billing.defaultProvider === 'stripe' ? 'stripe' : 'yookassa'
			};
			billingReady = providers.yookassa || providers.stripe;
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

			const action = snap.provider === 'yookassa' ? 'cancel' : 'manage';
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
			if (!res.ok) throw new Error(body?.error ?? 'billing.portalFail');
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
			void refreshStatus();
		} else if (flag === 'cancel') {
			toasts.show(translate(lang, 'billing.cancelled'), 'info');
		}
		if (flag) {
			const url = new URL($page.url);
			url.searchParams.delete('billing');
			history.replaceState({}, '', `${url.pathname}${url.search}${url.hash || '#pro'}`);
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
					{#if snap.pro}
						<span class="billing-card__badge">{translate(lang, 'billing.activeBadge')}</span>
					{/if}
				</div>
				<p class="billing-card__lead">
					{snap.pro ? periodLabel : translate(lang, 'billing.lead')}
				</p>
			</div>
		</header>

		<div class="billing-card__feature">
			<span class="billing-card__feature-icon" aria-hidden="true">
				<Camera size={20} weight="duotone" />
			</span>
			<p class="billing-card__feature-text">{translate(lang, 'billing.benefitRecognize')}</p>
		</div>

		{#if snap.pro}
			{#if snap.provider === 'stripe'}
				<AppButton
					variant="secondary"
					block
					class="min-h-[48px] mt-1"
					disabled={portalBusy}
					onclick={() => void openPortal()}
				>
					{portalBusy ? '…' : translate(lang, 'billing.manage')}
				</AppButton>
			{:else if snap.provider === 'yookassa' && snap.status !== 'canceled'}
				<AppButton
					variant="ghost"
					block
					class="min-h-[48px] mt-1"
					disabled={portalBusy}
					onclick={() => void openPortal()}
				>
					{portalBusy ? '…' : translate(lang, 'billing.cancel')}
				</AppButton>
			{/if}
		{:else if billingReady === null}
			<p class="billing-card__status" aria-live="polite">{translate(lang, 'billing.checking')}</p>
		{:else if !billingReady}
			<p class="billing-card__status billing-card__status--muted">
				{translate(lang, 'billing.unavailable')}
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
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		padding: 1rem 1.05rem 1.1rem;
		border: 1px solid color-mix(in srgb, var(--color-accent) 28%, var(--color-border));
		background:
			radial-gradient(
				120% 90% at 0% 0%,
				color-mix(in srgb, var(--color-accent) 16%, transparent) 0%,
				transparent 55%
			),
			var(--color-panel, var(--color-surface));
		box-shadow: 0 1px 0 color-mix(in srgb, var(--color-accent) 12%, transparent);
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
		gap: 0.2rem;
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
		gap: 0.7rem;
		min-height: 48px;
		padding: 0.65rem 0.75rem;
		border-radius: 0.85rem;
		border: 1px solid color-mix(in srgb, var(--color-accent) 18%, var(--color-border));
		background: color-mix(in srgb, var(--color-accent) 8%, var(--color-panel, var(--color-surface)));
	}

	.billing-card__feature-icon {
		display: grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		flex-shrink: 0;
		border-radius: 0.55rem;
		color: var(--color-accent-text, var(--color-accent));
		background: color-mix(in srgb, var(--color-accent) 16%, transparent);
	}

	.billing-card__feature-text {
		margin: 0;
		font-size: 0.92rem;
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

	.billing-card__status--muted {
		padding: 0.55rem 0.7rem;
		border-radius: 0.7rem;
		background: color-mix(in srgb, var(--color-surface-muted, #888) 18%, transparent);
	}
</style>
