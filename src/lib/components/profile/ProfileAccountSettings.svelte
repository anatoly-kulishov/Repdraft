<script lang="ts">
	import { goto } from '$app/navigation';
	import AppButton from '$lib/components/AppButton.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import AppLabel from '$lib/components/AppLabel.svelte';
	import ConfirmSheet from '$lib/components/ConfirmSheet.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import ProfileSettingsRow from '$lib/components/ProfileSettingsRow.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { translate, translateError } from '$lib/i18n/messages';
	import { auth } from '$lib/stores/auth';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';
	import { CaretDown as ChevronDown, FileText, Info, ShieldCheck, SignOut } from 'phosphor-svelte';

	let lang = $derived($resolvedLocale);
	let accountBusy = $state<'logout' | 'logoutEverywhere' | 'delete' | null>(null);
	let logoutConfirmOpen = $state(false);
	let logoutEverywhereConfirmOpen = $state(false);
	let deleteZoneOpen = $state(false);
	let deleteConfirmOpen = $state(false);
	let deleteConfirmText = $state('');
	let deleteConfirmWord = $derived(translate(lang, 'auth.deleteConfirmWord'));
	let deleteConfirmReady = $derived(
		deleteConfirmText.trim().toUpperCase() === deleteConfirmWord.toUpperCase()
	);
	let accountLocked = $derived(accountBusy !== null);

	function mapErr(err: unknown): string {
		return translateError(lang, err);
	}

	async function logout() {
		if (accountBusy) return;
		logoutConfirmOpen = false;
		accountBusy = 'logout';
		try {
			await auth.signOut();
			toasts.show(translate(lang, 'auth.signedOut'), 'info');
			await goto('/auth', { replaceState: true });
		} catch (err) {
			toasts.show(mapErr(err) || translateError(lang, err, 'auth.signOutError'), 'error');
		} finally {
			accountBusy = null;
		}
	}

	async function logoutEverywhere() {
		if (accountBusy) return;
		logoutEverywhereConfirmOpen = false;
		accountBusy = 'logoutEverywhere';
		try {
			await auth.signOutEverywhere();
			toasts.show(translate(lang, 'auth.logoutEverywhereDone'), 'info');
			await goto('/auth', { replaceState: true });
		} catch (err) {
			toasts.show(mapErr(err) || translateError(lang, err, 'auth.signOutError'), 'error');
		} finally {
			accountBusy = null;
		}
	}

	async function deleteAccount() {
		if (accountBusy || !deleteConfirmReady) return;
		accountBusy = 'delete';
		try {
			await auth.deleteAccount();
			toasts.show(translate(lang, 'auth.deleteDone'), 'info');
			await goto('/', { replaceState: true });
		} catch (err) {
			toasts.show(mapErr(err) || translateError(lang, err, 'auth.deleteFail'), 'error');
		} finally {
			accountBusy = null;
		}
	}
</script>

<div
	class="profile-settings-group panel"
	class:profile-settings-group--busy={accountLocked}
	aria-busy={accountLocked || undefined}
>
	<p class="profile-settings-group__title">{translate(lang, 'settings.accountTitle')}</p>
	<ProfileSettingsRow
		icon={FileText}
		iconTone="accent"
		label={translate(lang, 'terms.link')}
		href="/terms"
		disabled={accountLocked}
	/>
	<ProfileSettingsRow
		icon={ShieldCheck}
		iconTone="accent"
		label={translate(lang, 'privacy.link')}
		href="/privacy"
		disabled={accountLocked}
	/>
	<ProfileSettingsRow
		icon={SignOut}
		iconTone="accent"
		label={translate(lang, 'auth.logout')}
		busy={accountBusy === 'logout'}
		disabled={accountLocked}
		onclick={() => {
			if (!accountBusy) logoutConfirmOpen = true;
		}}
	/>
	<div class="profile-settings-group__session-footer">
		<div class="auth-session-note">
			<LucideIcon icon={Info} size={ICON_SMALL} class="auth-session-note__icon" />
			<p>{translate(lang, 'auth.logoutEverywhereHint')}</p>
		</div>
		<button
			type="button"
			class="profile-settings-group__text-action"
			disabled={accountLocked}
			aria-busy={accountBusy === 'logoutEverywhere' || undefined}
			onclick={() => {
				if (!accountBusy) logoutEverywhereConfirmOpen = true;
			}}
		>
			{#if accountBusy === 'logoutEverywhere'}
				<span class="profile-settings-group__text-action-busy">
					<Spinner size="sm" block={false} />
					{translate(lang, 'auth.logoutEverywhere')}
				</span>
			{:else}
				{translate(lang, 'auth.logoutEverywhere')}
			{/if}
		</button>
	</div>
</div>

<div
	class="auth-danger-zone"
	class:auth-danger-zone--open={deleteZoneOpen}
>
	<button
		type="button"
		class="auth-danger-zone__disclosure"
		aria-expanded={deleteZoneOpen}
		aria-controls={deleteZoneOpen ? 'auth-danger-body' : undefined}
		disabled={accountLocked}
		onclick={() => {
			deleteZoneOpen = !deleteZoneOpen;
			if (!deleteZoneOpen) {
				deleteConfirmOpen = false;
				deleteConfirmText = '';
			}
		}}
	>
		<span class="auth-danger-zone__disclosure-text">
			<span class="auth-danger-zone__eyebrow">{translate(lang, 'auth.deleteZoneLabel')}</span>
			<span id="auth-danger-title" class="auth-danger-zone__title">
				{translate(lang, 'auth.deleteTitle')}
			</span>
		</span>
		<LucideIcon icon={ChevronDown} size={ICON_SMALL} class="auth-danger-zone__chevron" />
	</button>

	{#if deleteZoneOpen}
		<div id="auth-danger-body" class="auth-danger-zone__body">
			<p class="auth-danger-zone__lead">{translate(lang, 'auth.deleteLead')}</p>
			<ul class="auth-danger-zone__list">
				<li>{translate(lang, 'auth.deleteBulletPlans')}</li>
				<li>{translate(lang, 'auth.deleteBulletRecords')}</li>
				<li>{translate(lang, 'auth.deleteBulletSessions')}</li>
				<li>{translate(lang, 'auth.deleteBulletClips')}</li>
			</ul>

			{#if !deleteConfirmOpen}
				<AppButton
					variant="danger"
					class="auth-danger-zone__trigger"
					disabled={accountLocked}
					onclick={() => {
						deleteConfirmOpen = true;
						deleteConfirmText = '';
					}}
				>
					{translate(lang, 'auth.deleteButton')}
				</AppButton>
			{:else}
				<div class="auth-danger-zone__confirm" role="group" aria-labelledby="auth-delete-confirm-hint">
					<AppLabel for="auth-delete-confirm">
						<span id="auth-delete-confirm-hint">
							{translate(lang, 'auth.deleteConfirmHint', { word: deleteConfirmWord })}
						</span>
						<AppInput
							id="auth-delete-confirm"
							class="mt-1 w-full"
							type="text"
							autocomplete="off"
							autocapitalize="characters"
							spellcheck="false"
							placeholder={deleteConfirmWord}
							bind:value={deleteConfirmText}
							disabled={accountLocked}
						/>
					</AppLabel>
					<div class="auth-danger-zone__confirm-actions">
						<AppButton
							variant="secondary"
							disabled={accountLocked}
							onclick={() => {
								deleteConfirmOpen = false;
								deleteConfirmText = '';
							}}
						>
							{translate(lang, 'auth.deleteCancel')}
						</AppButton>
						<AppButton
							variant="danger"
							disabled={accountLocked || !deleteConfirmReady}
							aria-busy={accountBusy === 'delete'}
							onclick={() => void deleteAccount()}
						>
							{#if accountBusy === 'delete'}
								<span class="inline-flex items-center gap-2">
									<Spinner size="sm" block={false} />
									{translate(lang, 'auth.deleteButtonFinal')}
								</span>
							{:else}
								{translate(lang, 'auth.deleteButtonFinal')}
							{/if}
						</AppButton>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<ConfirmSheet
	open={logoutConfirmOpen}
	titleId="auth-logout-title"
	title={translate(lang, 'auth.logoutConfirmTitle')}
	hint={translate(lang, 'auth.logoutConfirmLead')}
	confirmLabel={translate(lang, 'auth.logout')}
	variant="danger"
	busy={accountBusy === 'logout'}
	onConfirm={() => void logout()}
	onDismiss={() => {
		logoutConfirmOpen = false;
	}}
/>
<ConfirmSheet
	open={logoutEverywhereConfirmOpen}
	titleId="auth-logout-everywhere-title"
	title={translate(lang, 'auth.logoutEverywhereConfirmTitle')}
	hint={translate(lang, 'auth.logoutEverywhereConfirmLead')}
	confirmLabel={translate(lang, 'auth.logoutEverywhereConfirmAction')}
	variant="danger"
	busy={accountBusy === 'logoutEverywhere'}
	onConfirm={() => void logoutEverywhere()}
	onDismiss={() => {
		logoutEverywhereConfirmOpen = false;
	}}
/>
