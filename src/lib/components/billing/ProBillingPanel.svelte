<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import AppButton from '$lib/components/AppButton.svelte';
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
	import { CrownSimple } from 'phosphor-svelte';
	import { onMount } from 'svelte';

	let lang = $derived($resolvedLocale);
	let user = $derived($auth.user);
	let snap = $derived(
		proFromAppMetadata(user?.app_metadata as Record<string, unknown> | undefined)
	);

	let busyPlan = $state<ProPlan | null>(null);
	let portalBusy = $state(false);
	let billingReady = $state(false);
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
		if (!browser) return;
		void loadAvailability();
		if (user) void refreshStatus();

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

<div id="pro" class="profile-settings-group panel profile-settings-group--compact text-left">
	<p class="profile-settings-group__title billing-title">
		<span class="billing-title__icon" aria-hidden="true">
			<CrownSimple size={18} weight="fill" />
		</span>
		{translate(lang, 'billing.title')}
	</p>

	{#if snap.pro}
		<p class="profile-settings-group__hint">{periodLabel}</p>
		<p class="profile-settings-group__hint">{translate(lang, 'billing.benefitRecognize')}</p>
		{#if snap.provider === 'stripe'}
			<AppButton
				variant="secondary"
				block
				class="min-h-[48px] mt-2"
				disabled={portalBusy}
				onclick={() => void openPortal()}
			>
				{portalBusy ? '…' : translate(lang, 'billing.manage')}
			</AppButton>
		{:else if snap.provider === 'yookassa' && snap.status !== 'canceled'}
			<AppButton
				variant="ghost"
				block
				class="min-h-[48px] mt-2"
				disabled={portalBusy}
				onclick={() => void openPortal()}
			>
				{portalBusy ? '…' : translate(lang, 'billing.cancel')}
			</AppButton>
		{/if}
	{:else}
		<p class="profile-settings-group__hint">{translate(lang, 'billing.lead')}</p>
		<ul class="billing-benefits">
			<li>{translate(lang, 'billing.benefitRecognize')}</li>
		</ul>
		{#if !billingReady}
			<p class="profile-settings-group__hint">{translate(lang, 'billing.unavailable')}</p>
		{:else}
			<div class="billing-actions">
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
	{/if}
</div>

<style>
	.billing-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.billing-title__icon {
		display: inline-flex;
		color: var(--color-accent, #c4f542);
	}
	.billing-benefits {
		margin: 0.5rem 0 0;
		padding-left: 1.1rem;
		font-size: 0.9rem;
		color: var(--color-muted, #9ca3af);
	}
	.billing-actions {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}
</style>
