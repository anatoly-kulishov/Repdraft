<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import { parseExportJson, type RepdraftExportPayload } from '$lib/domain/exportData';
	import { translate, translateError } from '$lib/i18n/messages';
	import {
		applyLocalBackupImport,
		DEV_STRESS_BACKUP_HREF
	} from '$lib/storage/applyLocalBackupImport';
	import { auth } from '$lib/stores/auth';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';
	import { DatabaseZap, Eraser } from '@lucide/svelte';

	let loading = $state(false);
	let confirmOpen = $state(false);
	let stressBusy = $state(false);
	let stressOfferOpen = $state(false);
	let stressPayload = $state<RepdraftExportPayload | null>(null);

	let lang = $derived($resolvedLocale);

	function dismissConfirm() {
		if (loading) return;
		confirmOpen = false;
	}

	function dismissStressOffer() {
		if (stressBusy) return;
		stressOfferOpen = false;
		stressPayload = null;
	}

	async function wipeAll() {
		if (loading || stressBusy) return;
		loading = true;
		try {
			await auth.wipeLocalProfileForTesting();
			window.location.assign('/');
		} catch (err) {
			console.error('dev wipe failed', err);
			toasts.show(translate(lang, 'settings.devWipeFail'), 'error');
			loading = false;
		}
	}

	async function offerStressBackup() {
		if (loading || stressBusy) return;
		stressBusy = true;
		try {
			const res = await fetch(DEV_STRESS_BACKUP_HREF, { cache: 'no-store' });
			if (!res.ok) {
				toasts.show(translate(lang, 'settings.devStressMissing'), 'error');
				return;
			}
			const text = await res.text();
			const parsed = parseExportJson(text);
			if (!parsed.ok) {
				toasts.show(translate(lang, 'settings.importInvalidShape'), 'error');
				return;
			}
			stressPayload = parsed.payload;
			stressOfferOpen = true;
		} catch (err) {
			toasts.show(translateError(lang, err, 'settings.devStressFail'), 'error');
		} finally {
			stressBusy = false;
		}
	}

	async function commitStressBackup() {
		if (!stressPayload || stressBusy) return;
		stressBusy = true;
		await new Promise<void>((resolve) =>
			requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
		);
		try {
			const { cloudSynced, useCloud } = await applyLocalBackupImport(stressPayload);
			if (useCloud && !cloudSynced) {
				toasts.show(translate(lang, 'settings.importCloudPending'), 'info');
			} else {
				toasts.show(translate(lang, 'settings.importDone'), 'success');
			}
			stressOfferOpen = false;
			stressPayload = null;
		} catch (err) {
			toasts.show(translateError(lang, err, 'settings.importFail'), 'error');
		} finally {
			stressBusy = false;
		}
	}
</script>

<div class="profile-dev-wipe panel">
	<div class="profile-dev-wipe__head">
		<span class="profile-dev-wipe__icon" aria-hidden="true">
			<LucideIcon icon={Eraser} size={ICON_SMALL} />
		</span>
		<div class="profile-dev-wipe__copy min-w-0">
			<p class="profile-settings-group__title profile-dev-wipe__title">
				{translate(lang, 'settings.devWipeTitle')}
			</p>
			<p class="profile-settings-group__hint profile-dev-wipe__lead">
				{translate(lang, 'settings.devWipeLead')}
			</p>
		</div>
	</div>

	<div class="profile-dev-wipe__actions">
		<AppButton
			variant="secondary"
			block
			class="profile-dev-wipe__stress"
			disabled={loading || stressBusy}
			aria-busy={stressBusy}
			onclick={() => void offerStressBackup()}
		>
			{#if stressBusy && !stressOfferOpen}
				<span class="inline-flex items-center justify-center gap-2">
					<Spinner size="sm" block={false} />
					{translate(lang, 'auth.wait')}
				</span>
			{:else}
				<span class="inline-flex items-center justify-center gap-2">
					<LucideIcon icon={DatabaseZap} size={ICON_SMALL} />
					{translate(lang, 'settings.devStressButton')}
				</span>
			{/if}
		</AppButton>

		<AppButton
			variant="danger"
			block
			class="profile-dev-wipe__trigger"
			disabled={loading || stressBusy}
			onclick={() => {
				confirmOpen = true;
			}}
		>
			{translate(lang, 'settings.devWipeButton')}
		</AppButton>
	</div>
</div>

<BottomSheet
	bind:open={confirmOpen}
	titleId="dev-wipe-confirm-title"
	dismissible={!loading}
	onDismiss={dismissConfirm}
>
	<p id="dev-wipe-confirm-title" class="bottom-sheet__title">
		{translate(lang, 'settings.devWipeConfirmTitle')}
	</p>
	<p class="bottom-sheet__hint">{translate(lang, 'settings.devWipeConfirmHint')}</p>
	{#snippet actions()}
		<AppButton variant="secondary" disabled={loading} onclick={dismissConfirm}>
			{translate(lang, 'settings.devWipeCancel')}
		</AppButton>
		<AppButton variant="danger" disabled={loading} aria-busy={loading} onclick={() => void wipeAll()}>
			{#if loading}
				<span class="inline-flex items-center gap-2">
					<Spinner size="sm" block={false} />
					{translate(lang, 'auth.wait')}
				</span>
			{:else}
				{translate(lang, 'settings.devWipeButton')}
			{/if}
		</AppButton>
	{/snippet}
</BottomSheet>

{#if stressOfferOpen}
	<BottomSheet
		open={stressOfferOpen}
		titleId="dev-stress-import-title"
		dismissible={!stressBusy}
		onDismiss={dismissStressOffer}
	>
		<p id="dev-stress-import-title" class="bottom-sheet__title">
			{translate(lang, 'settings.devStressConfirmTitle')}
		</p>
		<p class="bottom-sheet__hint">
			{translate(lang, 'settings.devStressConfirmHint', {
				plans: String(stressPayload?.plans.length ?? 0),
				sessions: String(stressPayload?.sessions.length ?? 0),
				records: String(stressPayload?.records.length ?? 0)
			})}
		</p>
		{#snippet actions()}
			<AppButton variant="secondary" disabled={stressBusy} onclick={dismissStressOffer}>
				{translate(lang, 'common.cancel')}
			</AppButton>
			<AppButton
				disabled={stressBusy}
				aria-busy={stressBusy}
				onclick={() => void commitStressBackup()}
			>
				{#if stressBusy}
					<span class="inline-flex items-center justify-center gap-2">
						<Spinner size="sm" block={false} />
						{translate(lang, 'auth.wait')}
					</span>
				{:else}
					{translate(lang, 'settings.importConfirmCta')}
				{/if}
			</AppButton>
		{/snippet}
	</BottomSheet>
{/if}
