<script lang="ts">
	import { goto } from '$app/navigation';
	import AppButton from '$lib/components/AppButton.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import AppLabel from '$lib/components/AppLabel.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import ConfirmSheet from '$lib/components/ConfirmSheet.svelte';
	import ProfileSettingsRow from '$lib/components/ProfileSettingsRow.svelte';
	import ProfileSettingsSection from '$lib/components/profile/ProfileSettingsSection.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { translate, translateError } from '$lib/i18n/messages';
	import { auth } from '$lib/stores/auth';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';
	import { Devices, FileText, ShieldCheck } from 'phosphor-svelte';

	let lang = $derived($resolvedLocale);
	let accountBusy = $state<'logout' | 'logoutEverywhere' | 'delete' | null>(null);
	let logoutConfirmOpen = $state(false);
	let logoutEverywhereConfirmOpen = $state(false);
	let deleteSheetOpen = $state(false);
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

	function closeDeleteSheet() {
		if (accountBusy === 'delete') return;
		deleteSheetOpen = false;
		deleteConfirmOpen = false;
		deleteConfirmText = '';
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

<div class="profile-settings-hub" class:profile-settings-group--busy={accountLocked} aria-busy={accountLocked || undefined}>
	<ProfileSettingsSection label={translate(lang, 'settings.group.support')}>
		<ProfileSettingsRow
			icon={FileText}
			label={translate(lang, 'terms.link')}
			href="/terms"
			disabled={accountLocked}
		/>
		<ProfileSettingsRow
			icon={ShieldCheck}
			label={translate(lang, 'privacy.link')}
			href="/privacy"
			disabled={accountLocked}
		/>
	</ProfileSettingsSection>

	<ProfileSettingsSection
		label={translate(lang, 'settings.group.account')}
		hint={translate(lang, 'auth.logoutEverywhereHint')}
	>
		<ProfileSettingsRow
			icon={Devices}
			label={translate(lang, 'auth.logoutEverywhere')}
			chevron={false}
			busy={accountBusy === 'logoutEverywhere'}
			disabled={accountLocked}
			onclick={() => {
				if (!accountBusy) logoutEverywhereConfirmOpen = true;
			}}
		/>
	</ProfileSettingsSection>

	<div class="profile-settings-actions">
		<button
			type="button"
			class="profile-settings-signout"
			disabled={accountLocked}
			aria-busy={accountBusy === 'logout' || undefined}
			onclick={() => {
				if (!accountBusy) logoutConfirmOpen = true;
			}}
		>
			{#if accountBusy === 'logout'}
				<span class="profile-settings-signout__busy">
					<Spinner size="sm" block={false} />
					{translate(lang, 'auth.logout')}
				</span>
			{:else}
				{translate(lang, 'auth.logout')}
			{/if}
		</button>
		<button
			type="button"
			class="profile-settings-delete"
			disabled={accountLocked}
			onclick={() => {
				if (accountBusy) return;
				deleteSheetOpen = true;
				deleteConfirmOpen = false;
				deleteConfirmText = '';
			}}
		>
			{translate(lang, 'auth.deleteButton')}
		</button>
	</div>
</div>

<BottomSheet
	bind:open={deleteSheetOpen}
	titleId="auth-danger-title"
	label={translate(lang, 'auth.deleteTitle')}
	dismissible={accountBusy !== 'delete'}
	onDismiss={closeDeleteSheet}
>
	<p id="auth-danger-title" class="bottom-sheet__title">{translate(lang, 'auth.deleteTitle')}</p>
	<p class="bottom-sheet__hint">{translate(lang, 'auth.deleteLead')}</p>
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
</BottomSheet>

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
