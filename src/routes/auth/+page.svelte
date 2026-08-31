<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import {
		authErrorMessageKey,
		googleOAuthEnabled,
		passwordsMatch,
		safeRedirectPath,
		userAvatarUrl,
		userAuthProvider,
		userDisplayName,
		userInitials
	} from '$lib/domain/authFlow';
	import { translate, translateError } from '$lib/i18n/messages';
	import { auth } from '$lib/stores/auth';
	import { greetingName } from '$lib/stores/greetingName';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';
	import AppButton from '$lib/components/AppButton.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import AppLabel from '$lib/components/AppLabel.svelte';
	import AuthInterfacePrefs from '$lib/components/AuthInterfacePrefs.svelte';
	import BrandTagline from '$lib/components/BrandTagline.svelte';
	import PageSkeleton from '$lib/components/PageSkeleton.svelte';
	import PasswordField from '$lib/components/PasswordField.svelte';
	import ProfileSettingsRow from '$lib/components/ProfileSettingsRow.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import SubrouteBack from '$lib/components/SubrouteBack.svelte';
	import DataExportSection from '$lib/components/DataExportSection.svelte';
	import ProfileDevWipePanel from '$lib/components/ProfileDevWipePanel.svelte';
	import OnboardingChecklist from '$lib/components/onboarding/OnboardingChecklist.svelte';
	import { APP_VERSION_LABEL } from '$lib/appVersion';
	import { GREETING_NAME_MAX, clampGreetingName, greetingNameMatchesStored } from '$lib/domain/greetingName';
	import { isIosDevice } from '$lib/domain/pwaInstall';
	import { restSoundEnabled } from '$lib/stores/prefs';
	import { get } from 'svelte/store';
	import { tick } from 'svelte';
	import { appTheme } from '$lib/stores/theme';
	import { themeToggleStateIcon } from '$lib/components/icons/themeToggle';
	import { Globe, LogOut, Timer, Shield, ClipboardList } from '@lucide/svelte';


	type Panel = 'signin' | 'signup' | 'magic' | 'forgot' | 'check-email';

	let panel = $state<Panel>('signin');
	let email = $state('');
	let password = $state('');
	let passwordConfirm = $state('');
	let loading = $state(false);
	let message = $state<string | null>(null);
	let checkEmailKind = $state<'signup' | 'magic' | 'reset'>('signup');
	let redirected = $state(false);
	let greetingNameInput = $state('');
	let greetingNameSaving = $state(false);
	let fieldsInvalid = $state(false);
	let deleteConfirmOpen = $state(false);
	let deleteConfirmText = $state('');

	async function flashInvalid() {
		fieldsInvalid = false;
		await tick();
		fieldsInvalid = true;
	}

	let lang = $derived($resolvedLocale);
	let nextLang = $derived(lang === 'ru' ? ('en' as const) : ('ru' as const));
	let theme = $derived($appTheme);
	let nextTheme = $derived(theme === 'dark' ? ('light' as const) : ('dark' as const));
	let restSoundHintKey = $derived(
		browser &&
			isIosDevice({
				ua: navigator.userAgent,
				platform: navigator.platform,
				maxTouchPoints: navigator.maxTouchPoints,
				coarsePointer: window.matchMedia('(pointer: coarse)').matches
			})
			? 'settings.restSoundHintIos'
			: 'settings.restSoundHint'
	);
	let deleteConfirmWord = $derived(translate(lang, 'auth.deleteConfirmWord'));
	let deleteConfirmReady = $derived(deleteConfirmText.trim() === deleteConfirmWord);
	let nextPath = $derived(safeRedirectPath($page.url.searchParams.get('next')));
	let recoveryMode = $derived($auth.passwordRecovery);
	let profileName = $derived(userDisplayName($auth.user));
	let profileAvatar = $derived(userAvatarUrl($auth.user));
	let profileInitials = $derived(userInitials($auth.user));
	let profileAvatarBroken = $state(false);
	let showProfilePhoto = $derived(Boolean(profileAvatar) && !profileAvatarBroken);
	let profileProvider = $derived(userAuthProvider($auth.user));
	let profileProviderLabel = $derived.by(() => {
		const id = profileProvider;
		if (!id) return null;
		if (id === 'google') return translate(lang, 'auth.provider.google');
		if (id === 'email') return translate(lang, 'auth.provider.email');
		return translate(lang, 'auth.provider.other', {
			name: id.charAt(0).toUpperCase() + id.slice(1)
		});
	});

	$effect(() => {
		profileAvatar;
		profileAvatarBroken = false;
	});
	let backLabel = $derived(
		nextPath === '/' ? translate(lang, 'nav.tabHome') : translate(lang, 'a11y.back')
	);

	$effect(() => {
		if (!$auth.ready || !$auth.user || recoveryMode || redirected) return;
		const params = $page.url.searchParams;
		const hash = typeof window !== 'undefined' ? window.location.hash : '';
		const fromCallback =
			params.has('code') ||
			/access_token|type=signup|type=magiclink|type=email|type=invite/.test(hash);
		if (!fromCallback) return;
		redirected = true;
		toasts.show(translate(lang, 'auth.signinToast'), 'success');
		void goto(nextPath, { replaceState: true });
	});

	function mapErr(err: unknown): string {
		const key = authErrorMessageKey(err);
		if (key) return translate(lang, key);
		return translateError(lang, err, 'auth.error');
	}

	function openCheckEmail(kind: typeof checkEmailKind) {
		checkEmailKind = kind;
		panel = 'check-email';
		message = null;
		password = '';
		passwordConfirm = '';
	}

	async function submitPassword() {
		if (!$auth.configured) {
			toasts.show(translate(lang, 'auth.notConfigured'), 'error');
			return;
		}
		loading = true;
		message = null;
		fieldsInvalid = false;
		try {
			if (panel === 'signup') {
				if (!passwordsMatch(password, passwordConfirm)) {
					throw new Error('auth.errors.passwordMismatch');
				}
				const { session } = await auth.signUp(email.trim(), password, nextPath);
				if (session) {
					toasts.show(translate(lang, 'auth.signinToast'), 'success');
					redirected = true;
					await goto(nextPath, { replaceState: true });
					return;
				}
				toasts.show(translate(lang, 'auth.signupToast'), 'success');
				openCheckEmail('signup');
			} else {
				await auth.signIn(email.trim(), password);
				toasts.show(translate(lang, 'auth.signinToast'), 'success');
				redirected = true;
				await goto(nextPath, { replaceState: true });
			}
		} catch (err) {
			const text = mapErr(err);
			message = text;
			toasts.show(text, 'error');
			void flashInvalid();
		} finally {
			loading = false;
		}
	}

	async function submitMagic() {
		if (!$auth.configured) {
			toasts.show(translate(lang, 'auth.notConfigured'), 'error');
			return;
		}
		loading = true;
		message = null;
		fieldsInvalid = false;
		try {
			await auth.signInWithOtp(email.trim(), nextPath);
			toasts.show(translate(lang, 'auth.magicToast'), 'success');
			openCheckEmail('magic');
		} catch (err) {
			const text = mapErr(err);
			message = text;
			toasts.show(text, 'error');
			void flashInvalid();
		} finally {
			loading = false;
		}
	}

	async function submitForgot() {
		if (!$auth.configured) {
			toasts.show(translate(lang, 'auth.notConfigured'), 'error');
			return;
		}
		loading = true;
		message = null;
		fieldsInvalid = false;
		try {
			await auth.resetPasswordForEmail(email.trim());
			toasts.show(translate(lang, 'auth.resetToast'), 'success');
			openCheckEmail('reset');
		} catch (err) {
			const text = mapErr(err);
			message = text;
			toasts.show(text, 'error');
			void flashInvalid();
		} finally {
			loading = false;
		}
	}

	async function submitRecovery() {
		loading = true;
		message = null;
		fieldsInvalid = false;
		try {
			if (!passwordsMatch(password, passwordConfirm)) {
				throw new Error('auth.errors.passwordMismatch');
			}
			await auth.updatePassword(password);
			toasts.show(translate(lang, 'auth.passwordUpdated'), 'success');
			password = '';
			passwordConfirm = '';
			redirected = true;
			await goto(nextPath, { replaceState: true });
		} catch (err) {
			const text = mapErr(err);
			message = text;
			toasts.show(text, 'error');
			void flashInvalid();
		} finally {
			loading = false;
		}
	}

	async function google() {
		if (!$auth.configured) {
			toasts.show(translate(lang, 'auth.notConfigured'), 'error');
			return;
		}
		loading = true;
		message = null;
		fieldsInvalid = false;
		try {
			await auth.signInWithOAuth('google', nextPath);
		} catch (err) {
			const text = mapErr(err);
			message = text;
			toasts.show(text, 'error');
			loading = false;
		}
	}

	async function logout() {
		if (loading) return;
		loading = true;
		try {
			await auth.signOut();
			toasts.show(translate(lang, 'auth.signedOut'), 'info');
		} catch (err) {
			toasts.show(mapErr(err) || translateError(lang, err, 'auth.signOutError'), 'error');
		} finally {
			loading = false;
		}
	}

	async function openDeleteConfirm() {
		deleteConfirmOpen = true;
		deleteConfirmText = '';
		await tick();
		document.getElementById('auth-delete-confirm')?.focus();
	}

	function cancelDeleteConfirm() {
		deleteConfirmOpen = false;
		deleteConfirmText = '';
	}

	async function deleteAccount() {
		if (loading || !deleteConfirmReady) return;
		loading = true;
		try {
			await auth.deleteAccount();
			toasts.show(translate(lang, 'auth.deleteDone'), 'info');
			await goto('/', { replaceState: true });
		} catch (err) {
			toasts.show(mapErr(err) || translateError(lang, err, 'auth.deleteFail'), 'error');
		} finally {
			loading = false;
		}
	}

	function setPanel(next: Panel) {
		panel = next;
		message = null;
	}

	function openMagicLink() {
		setPanel('magic');
	}

	function setPasswordMode(mode: 'signin' | 'signup') {
		message = null;
		panel = mode;
	}

	let passwordMode = $derived(
		panel === 'signup' ? ('signup' as const) : panel === 'forgot' ? ('forgot' as const) : ('signin' as const)
	);
	let accountMode = $derived($auth.ready && Boolean($auth.user) && !recoveryMode);
	/**
	 * Boot skeleton: prefer account grid when a signed-in session is likely.
	 * app.html peek sets `dataset.authBoot` before Svelte mounts (offline-safe, no server load).
	 */
	let bootLikelyAccount = $derived(
		browser && document.documentElement.dataset.authBoot === 'account'
	);
	/** Dev/QA: force boot skeleton via ?skeleton=account|guest */
	let skeletonForce = $derived(
		$page.url.searchParams.get('skeleton') === 'account'
			? ('account' as const)
			: $page.url.searchParams.get('skeleton') === 'guest'
				? ('guest' as const)
				: null
	);
	let showAccountSkeleton = $derived(
		skeletonForce === 'account' ||
			((!browser || !$auth.ready) && !skeletonForce && bootLikelyAccount)
	);
	let showGuestSkeleton = $derived(
		skeletonForce === 'guest' ||
			((!browser || !$auth.ready) && !skeletonForce && !bootLikelyAccount)
	);
	let showBootSkeleton = $derived(showAccountSkeleton || showGuestSkeleton);
	/** Real cloud-off UI only after client auth finished and keys are missing. */
	let showCloudOff = $derived(browser && $auth.ready && !$auth.configured && !showBootSkeleton);
	let guestExtrasMode = $derived(
		$auth.ready && !accountMode && !recoveryMode && !showBootSkeleton
	);

	$effect(() => {
		if (accountMode) greetingNameInput = get(greetingName);
	});

	let greetingNameDirty = $derived(
		!greetingNameMatchesStored($greetingName, greetingNameInput)
	);

	async function saveGreetingName() {
		if (greetingNameSaving || !$auth.user || !greetingNameDirty) return;
		greetingNameSaving = true;
		try {
			const saved = await greetingName.save(greetingNameInput, $auth.user.id);
			if (saved) {
				toasts.show(translate(lang, 'auth.greetingNameSaved'), 'success');
			}
		} catch (err) {
			toasts.show(translateError(lang, err, 'auth.greetingNameSaveFail'), 'error');
		} finally {
			greetingNameSaving = false;
		}
	}

</script>

<svelte:head>
	<title>{translate(lang, 'auth.title')} · Repdraft</title>
</svelte:head>

<section
	class="auth-page content-page"
	class:auth-page--account={accountMode && !showBootSkeleton}
	class:auth-page--booting={showBootSkeleton}
	class:auth-page--booting-account={showAccountSkeleton}
	class:auth-page--booting-guest={showGuestSkeleton}
>
	<div class="lg:hidden">
		{#if $auth.ready && !showBootSkeleton}
			{#if accountMode}
				<ScreenHeader
					fixed
					title={translate(lang, 'auth.title')}
					backHref={nextPath}
					backLabel={backLabel}
				/>
			{:else if !recoveryMode}
				<ScreenHeader title={translate(lang, 'auth.title')} backHref={nextPath} />
			{/if}
		{/if}
	</div>
	{#if $auth.ready && !accountMode && !showBootSkeleton}
		<header class="page-header page-header--compact auth-page__header">
			<div class="subroute-desktop-head">
				<SubrouteBack href={nextPath} label={backLabel} />
			</div>
			<div class="auth-page__heading">
				<h1 class="page-title auth-page__title hidden lg:block">{translate(lang, 'auth.title')}</h1>
			</div>
			{#if guestExtrasMode}
				<BrandTagline class="brand-tagline--auth" />
			{/if}
		</header>
	{/if}

	{#if showBootSkeleton}
		<PageSkeleton variant={showAccountSkeleton ? 'auth' : 'auth-guest'} rows={2} />
	{:else if showCloudOff}
		<div class="auth-guest-stack">
			<div class="auth-signin panel">
				<p class="text-sm font-semibold">{translate(lang, 'auth.cloudOffTitle')}</p>
				<p class="mt-2 text-sm text-[var(--color-muted)]">{translate(lang, 'auth.cloudOffLead')}</p>
			</div>
			{@render guestSettingsPanel()}
		</div>
	{:else if recoveryMode}
		<div class="auth-panel panel">
			<form
				class="auth-panel__primary auth-form flex flex-col gap-3"
				onsubmit={(e) => {
					e.preventDefault();
					void submitRecovery();
				}}
			>
				<p class="text-sm font-semibold">{translate(lang, 'auth.recoveryTitle')}</p>
				<p class="text-sm text-[var(--color-muted)]">{translate(lang, 'auth.recoveryLead')}</p>
				<PasswordField
					bind:value={password}
					label={translate(lang, 'auth.newPassword')}
					placeholder={translate(lang, 'auth.passwordPh')}
					autocomplete="new-password"
					invalid={fieldsInvalid}
				/>
				<PasswordField
					bind:value={passwordConfirm}
					label={translate(lang, 'auth.passwordConfirm')}
					placeholder={translate(lang, 'auth.passwordConfirmPh')}
					autocomplete="new-password"
					invalid={fieldsInvalid}
				/>
				{#if message}
					<p class="auth-form__error" role="alert">{message}</p>
				{/if}
				<AppButton type="submit" block disabled={loading}>
					{#if loading}
						<span class="inline-flex items-center gap-2">
							<Spinner size="sm" block={false} />
							{translate(lang, 'auth.wait')}
						</span>
					{:else}
						{translate(lang, 'auth.submitNewPassword')}
					{/if}
				</AppButton>
			</form>
		</div>
	{:else if $auth.user}
		<div class="auth-account">
			<div class="auth-account__desktop-head hidden lg:block">
				<div class="subroute-desktop-head">
					<SubrouteBack href={nextPath} label={backLabel} />
				</div>
				<h1 class="page-title auth-page__title">{translate(lang, 'auth.title')}</h1>
			</div>

			<header class="profile-hero">
				<div class="profile-hero__stage">
					<div class="profile-hero__glow" aria-hidden="true"></div>
					{#if showProfilePhoto && profileAvatar}
						<img
							class="account-avatar is-photo profile-hero__avatar"
							src={profileAvatar}
							alt=""
							width="96"
							height="96"
							referrerpolicy="no-referrer"
							decoding="async"
							onerror={() => {
								profileAvatarBroken = true;
							}}
						/>
					{:else if profileInitials}
						<span class="account-avatar profile-hero__avatar" aria-hidden="true">{profileInitials}</span>
					{:else}
						<span class="account-avatar is-guest profile-hero__avatar" aria-hidden="true">
							{profileName?.charAt(0)?.toUpperCase() ?? '?'}
						</span>
					{/if}
				</div>

				<h2 class="profile-hero__name">{profileName || $auth.user.email}</h2>
				{#if profileName && $auth.user.email}
					<p class="profile-hero__meta">{$auth.user.email}</p>
				{/if}
				{#if profileProviderLabel}
					<span class="auth-provider-badge profile-hero__badge">{profileProviderLabel}</span>
				{/if}
			</header>

			<div class="profile-settings-stack">
				<form
					id="auth-greeting-panel"
					class="profile-settings-group panel"
					onsubmit={(e) => {
						e.preventDefault();
						void saveGreetingName();
					}}
				>
					<p class="profile-settings-group__title">{translate(lang, 'auth.greetingNameLabel')}</p>
					<AppInput
						id="auth-greeting-name"
						class="profile-settings-group__field"
						type="text"
						autocomplete="nickname"
						maxlength={GREETING_NAME_MAX}
						placeholder={translate(lang, 'auth.greetingNamePh')}
						value={greetingNameInput}
						aria-label={translate(lang, 'auth.greetingNameLabel')}
						oninput={(e) => {
							const el = e.currentTarget as HTMLInputElement;
							const next = clampGreetingName(el.value);
							greetingNameInput = next;
							if (el.value !== next) el.value = next;
						}}
					/>
					<p class="profile-settings-group__hint">{translate(lang, 'auth.greetingNameHint')}</p>
					<AppButton
						type="submit"
						variant="secondary"
						class="profile-settings-group__action"
						disabled={greetingNameSaving || !greetingNameDirty}
					>
						{#if greetingNameSaving}
							<span class="inline-flex items-center gap-2">
								<Spinner size="sm" block={false} />
								{translate(lang, 'auth.wait')}
							</span>
						{:else}
							{translate(lang, 'auth.greetingNameSave')}
						{/if}
					</AppButton>
				</form>

				{@render onboardingHelpPanel()}

				<div class="profile-settings-group panel">
					<p class="profile-settings-group__title">{translate(lang, 'settings.interfaceTitle')}</p>
					<ProfileSettingsRow
						icon={Globe}
						label={translate(lang, 'lang.label')}
						value={translate(lang, lang === 'ru' ? 'lang.ru' : 'lang.en')}
						ariaLabel={translate(lang, 'settings.cycleHint', {
							label: translate(lang, 'lang.label'),
							current: translate(lang, lang === 'ru' ? 'lang.ru' : 'lang.en'),
							next: translate(lang, nextLang === 'ru' ? 'lang.ru' : 'lang.en')
						})}
						onclick={() => resolvedLocale.set(nextLang)}
					/>
					<ProfileSettingsRow
						icon={themeToggleStateIcon(theme === 'light')}
						label={translate(lang, 'settings.theme')}
						value={translate(lang, theme === 'light' ? 'settings.themeLight' : 'settings.themeDark')}
						ariaLabel={translate(lang, 'settings.cycleHint', {
							label: translate(lang, 'settings.theme'),
							current: translate(lang, theme === 'light' ? 'settings.themeLight' : 'settings.themeDark'),
							next: translate(lang, nextTheme === 'light' ? 'settings.themeLight' : 'settings.themeDark')
						})}
						onclick={() => appTheme.set(nextTheme)}
					/>
					<p class="profile-settings-group__hint">{translate(lang, 'settings.themeHint')}</p>
				</div>

				<div class="profile-settings-group panel">
					<p class="profile-settings-group__title">{translate(lang, 'settings.sessionTitle')}</p>
					<ProfileSettingsRow icon={Timer} label={translate(lang, 'settings.restSound')}>
						<input
							type="checkbox"
							class="auth-pref-toggle__input profile-settings-row__toggle"
							checked={$restSoundEnabled}
							aria-label={translate(lang, 'settings.restSound')}
							onchange={(e) => {
								restSoundEnabled.set((e.currentTarget as HTMLInputElement).checked);
							}}
						/>
					</ProfileSettingsRow>
					<p class="profile-settings-group__hint">{translate(lang, restSoundHintKey)}</p>
				</div>

				<div class="profile-settings-group panel profile-settings-group--data">
					<p class="profile-settings-group__title">{translate(lang, 'settings.exportTitle')}</p>
					<p class="profile-settings-group__hint">{translate(lang, 'settings.exportHint')}</p>
					<DataExportSection embedded />
				</div>

				<ProfileDevWipePanel />

				<div class="auth-danger-zone" aria-labelledby="auth-danger-title">
					<p class="auth-danger-zone__eyebrow">{translate(lang, 'auth.deleteZoneLabel')}</p>
					<p id="auth-danger-title" class="auth-danger-zone__title">{translate(lang, 'auth.deleteTitle')}</p>
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
							disabled={loading}
							onclick={openDeleteConfirm}
						>
							{translate(lang, 'auth.deleteButton')}
						</AppButton>
					{:else}
						<div
							class="auth-danger-zone__confirm"
							role="group"
							aria-labelledby="auth-delete-confirm-hint"
						>
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
									disabled={loading}
									onkeydown={(e) => {
										if (e.key === 'Escape') cancelDeleteConfirm();
									}}
								/>
							</AppLabel>
							<div class="auth-danger-zone__confirm-actions">
								<AppButton variant="secondary" disabled={loading} onclick={cancelDeleteConfirm}>
									{translate(lang, 'auth.deleteCancel')}
								</AppButton>
								<AppButton
									variant="danger"
									disabled={loading || !deleteConfirmReady}
									aria-busy={loading}
									onclick={deleteAccount}
								>
									{#if loading}
										<span class="inline-flex items-center gap-2">
											<Spinner size="sm" block={false} />
											{translate(lang, 'auth.wait')}
										</span>
									{:else}
										{translate(lang, 'auth.deleteButtonFinal')}
									{/if}
								</AppButton>
							</div>
						</div>
					{/if}
				</div>

				<div class="profile-settings-group panel">
					<p class="profile-settings-group__title">{translate(lang, 'settings.accountTitle')}</p>
					<ProfileSettingsRow
						icon={ClipboardList}
						label={translate(lang, 'scenarios.link')}
						href="/scenarios"
					/>
					<ProfileSettingsRow
						icon={Shield}
						label={translate(lang, 'privacy.link')}
						href="/privacy"
					/>
					<ProfileSettingsRow
						icon={LogOut}
						iconTone="accent"
						label={loading ? translate(lang, 'auth.wait') : translate(lang, 'auth.logout')}
						ariaLabel={translate(lang, 'auth.logout')}
						onclick={() => {
							void logout();
						}}
					/>
				</div>
			</div>
			<p
				class="auth-account__version"
				aria-label={translate(lang, 'attr.versionAria', { version: APP_VERSION_LABEL })}
			>
				{APP_VERSION_LABEL}
			</p>
		</div>
	{:else if panel === 'check-email'}
		<div class="auth-guest-stack">
			<div class="auth-signin panel flex flex-col gap-3">
				<p class="font-semibold">{translate(lang, 'auth.checkEmailTitle')}</p>
				<p class="text-sm text-[var(--color-muted)]">
					{#if checkEmailKind === 'magic'}
						{translate(lang, 'auth.checkEmailMagic', { email: email.trim() })}
					{:else if checkEmailKind === 'reset'}
						{translate(lang, 'auth.checkEmailReset', { email: email.trim() })}
					{:else}
						{translate(lang, 'auth.checkEmailSignup', { email: email.trim() })}
					{/if}
				</p>
				<AppButton variant="secondary" block onclick={() => setPanel('signin')}>
					{translate(lang, 'auth.backToSignIn')}
				</AppButton>
			</div>
			{@render guestSettingsPanel()}
		</div>
	{:else}
		<div class="auth-guest-stack">
			<div class="auth-signin panel flex flex-col gap-4">
			{#if panel === 'magic'}
				<form
					class="auth-form flex flex-col gap-3"
					onsubmit={(e) => {
						e.preventDefault();
						void submitMagic();
					}}
				>
					<p class="text-sm leading-relaxed text-[var(--color-muted)]">{translate(lang, 'auth.magicLead')}</p>
					<AppLabel>
						{translate(lang, 'auth.email')}
						<AppInput
							class="mt-1 w-full"
							aria-invalid={fieldsInvalid || undefined}
							type="email"
							required
							autocomplete="email"
							inputmode="email"
							placeholder={translate(lang, 'auth.emailPh')}
							bind:value={email}
						/>
					</AppLabel>
					{#if message}
						<p class="auth-form__error" role="alert">{message}</p>
					{/if}
					<AppButton type="submit" block disabled={loading}>
						{#if loading}
							<span class="inline-flex items-center justify-center gap-2">
								<Spinner size="sm" block={false} />
								{translate(lang, 'auth.wait')}
							</span>
						{:else}
							{translate(lang, 'auth.submitMagic')}
						{/if}
					</AppButton>
					<AppButton variant="link" class="auth-form__back" onclick={() => setPanel('signin')}>
						{translate(lang, 'auth.backToPassword')}
					</AppButton>
				</form>
			{:else if panel !== 'forgot'}
				<div class="auth-segments" role="tablist" aria-label={translate(lang, 'auth.modeAria')}>
					<button
						type="button"
						class="auth-segment"
						class:is-active={passwordMode === 'signin'}
						role="tab"
						aria-selected={passwordMode === 'signin'}
						onclick={() => setPasswordMode('signin')}
					>
						{translate(lang, 'auth.signInTab')}
					</button>
					<button
						type="button"
						class="auth-segment"
						class:is-active={passwordMode === 'signup'}
						role="tab"
						aria-selected={passwordMode === 'signup'}
						onclick={() => setPasswordMode('signup')}
					>
						{translate(lang, 'auth.signUpTab')}
					</button>
				</div>
			{/if}

			{#if panel === 'signin' || panel === 'signup'}
				<form
					class="auth-form flex flex-col gap-3"
					onsubmit={(e) => {
						e.preventDefault();
						void submitPassword();
					}}
				>
					<AppLabel>
						{translate(lang, 'auth.email')}
						<AppInput
							class="mt-1 w-full"
							aria-invalid={fieldsInvalid || undefined}
							type="email"
							required
							autocomplete="email"
							inputmode="email"
							placeholder={translate(lang, 'auth.emailPh')}
							bind:value={email}
						/>
					</AppLabel>
					<PasswordField
						bind:value={password}
						label={translate(lang, 'auth.password')}
						placeholder={translate(lang, 'auth.passwordPh')}
						autocomplete={passwordMode === 'signup' ? 'new-password' : 'current-password'}
						invalid={fieldsInvalid}
					/>
					{#if passwordMode === 'signup'}
						<PasswordField
							bind:value={passwordConfirm}
							label={translate(lang, 'auth.passwordConfirm')}
							placeholder={translate(lang, 'auth.passwordConfirmPh')}
							autocomplete="new-password"
							invalid={fieldsInvalid}
						/>
					{/if}

					{#if passwordMode === 'signin'}
						<AppButton
							variant="link"
							class="auth-form__alt self-start text-sm"
							onclick={() => setPanel('forgot')}
						>
							{translate(lang, 'auth.forgot')}
						</AppButton>
					{/if}

					{#if message}
						<p class="auth-form__error" role="alert">{message}</p>
					{/if}

					<AppButton type="submit" block disabled={loading}>
						{#if loading}
							<span class="inline-flex items-center justify-center gap-2">
								<Spinner size="sm" block={false} />
								{translate(lang, 'auth.wait')}
							</span>
						{:else}
							{passwordMode === 'signup'
								? translate(lang, 'auth.submitSignUp')
								: translate(lang, 'auth.submitSignIn')}
						{/if}
					</AppButton>
					<AppButton variant="link" class="auth-form__alt auth-form__alt--center" onclick={openMagicLink}>
						{translate(lang, 'auth.useMagicLink')}
					</AppButton>
				</form>
			{:else if panel === 'forgot'}
				<form
					class="auth-form flex flex-col gap-3"
					onsubmit={(e) => {
						e.preventDefault();
						void submitForgot();
					}}
				>
					<p class="text-sm font-semibold text-[var(--color-ink)]">{translate(lang, 'auth.forgot')}</p>
					<p class="text-sm leading-relaxed text-[var(--color-muted)]">{translate(lang, 'auth.forgotLead')}</p>
					<AppLabel>
						{translate(lang, 'auth.email')}
						<AppInput
							class="mt-1 w-full"
							aria-invalid={fieldsInvalid || undefined}
							type="email"
							required
							autocomplete="email"
							inputmode="email"
							placeholder={translate(lang, 'auth.emailPh')}
							bind:value={email}
						/>
					</AppLabel>
					{#if message}
						<p class="auth-form__error" role="alert">{message}</p>
					{/if}
					<AppButton type="submit" block disabled={loading}>
						{#if loading}
							<span class="inline-flex items-center justify-center gap-2">
								<Spinner size="sm" block={false} />
								{translate(lang, 'auth.wait')}
							</span>
						{:else}
							{translate(lang, 'auth.submitReset')}
						{/if}
					</AppButton>
					<AppButton variant="secondary" block onclick={() => setPanel('signin')}>
						{translate(lang, 'auth.backToSignIn')}
					</AppButton>
				</form>
			{/if}

			{#if googleOAuthEnabled && (panel === 'signin' || panel === 'signup')}
				<div class="auth-divider" aria-hidden="true">
					<span>{translate(lang, 'auth.or')}</span>
				</div>

				<AppButton
					variant="secondary"
					block
					class="inline-flex items-center justify-center gap-2"
					disabled={loading}
					onclick={() => void google()}
				>
					<svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0" aria-hidden="true">
						<path
							fill="#EA4335"
							d="M12 10.2v3.6h5.1c-.2 1.2-1.5 3.6-5.1 3.6-3.1 0-5.6-2.5-5.6-5.6S8.9 6.2 12 6.2c1.8 0 3 .7 3.7 1.4l2.5-2.4C16.7 3.7 14.5 2.7 12 2.7 6.9 2.7 2.7 6.9 2.7 12S6.9 21.3 12 21.3c5.2 0 8.6-3.6 8.6-8.7 0-.6-.1-1-.1-1.4H12z"
						/>
						<path
							fill="#34A853"
							d="M3.8 7.4 6.8 9.6C7.7 7.5 9.6 6.2 12 6.2c1.8 0 3 .7 3.7 1.4l2.5-2.4C16.7 3.7 14.5 2.7 12 2.7 8.4 2.7 5.3 4.7 3.8 7.4z"
						/>
						<path
							fill="#4A90E2"
							d="M12 21.3c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.5-1.8.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8l-3 2.3c1.5 3 4.5 5 8.1 5z"
						/>
						<path
							fill="#FBBC05"
							d="M6.9 14c-.2-.5-.3-1.1-.3-1.7s.1-1.2.3-1.7L3.8 8.3C3.1 9.4 2.7 10.7 2.7 12s.4 2.6 1.1 3.7l3.1-1.7z"
						/>
					</svg>
					{translate(lang, 'auth.google')}
				</AppButton>
			{/if}
			</div>
			{@render guestSettingsPanel()}
		</div>
	{/if}
</section>

{#snippet guestSettingsPanel()}
	<div class="auth-settings panel">
		{@render onboardingHelpPanel()}
		<AuthInterfacePrefs />
		<DataExportSection />
		<ProfileDevWipePanel />
		<p class="auth-account__legal">
			<span class="auth-account__legal-label">{translate(lang, 'auth.privacyHint')}</span>
			<a class="auth-account__legal-link" href="/privacy">{translate(lang, 'privacy.link')}</a>
			<span class="auth-account__legal-sep" aria-hidden="true">·</span>
			<a class="auth-account__legal-link" href="/scenarios">{translate(lang, 'scenarios.link')}</a>
		</p>
	</div>
	<p
		class="auth-account__version"
		aria-label={translate(lang, 'attr.versionAria', { version: APP_VERSION_LABEL })}
	>
		{APP_VERSION_LABEL}
	</p>
{/snippet}

{#snippet onboardingHelpPanel()}
	<div class="onboarding-profile-block">
		<div class="profile-settings-group panel onboarding-auth-help">
			<p class="profile-settings-group__title">{translate(lang, 'onboarding.authHelp')}</p>
			<p class="profile-settings-group__hint">{translate(lang, 'onboarding.authHelpLead')}</p>
			<AppButton variant="secondary" block href="/articles">
				{translate(lang, 'articles.viewAll')}
			</AppButton>
		</div>
		<OnboardingChecklist readonly onTryDemo={() => {}} />
	</div>
{/snippet}
