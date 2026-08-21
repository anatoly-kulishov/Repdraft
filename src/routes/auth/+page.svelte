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
	import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
	import PageSkeleton from '$lib/components/PageSkeleton.svelte';
	import PasswordField from '$lib/components/PasswordField.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import SubrouteBack from '$lib/components/SubrouteBack.svelte';
	import DataExportSection from '$lib/components/DataExportSection.svelte';
	import { GREETING_NAME_MAX } from '$lib/domain/greetingName';
	import { isIosDevice } from '$lib/domain/pwaInstall';
	import type { AppTheme } from '$lib/domain/theme';
	import { appTheme } from '$lib/stores/theme';
	import { restSoundEnabled } from '$lib/stores/prefs';
	import { get } from 'svelte/store';
	import { tick } from 'svelte';

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

	function setAuthMethod(method: 'password' | 'magic') {
		message = null;
		if (method === 'magic') {
			panel = 'magic';
			return;
		}
		if (panel === 'forgot' || panel === 'magic' || panel === 'check-email') {
			panel = 'signin';
			return;
		}
		panel = panel === 'signup' ? 'signup' : 'signin';
	}

	function setPasswordMode(mode: 'signin' | 'signup') {
		message = null;
		panel = mode;
	}

	let authMethod = $derived(panel === 'magic' ? ('magic' as const) : ('password' as const));
	let passwordMode = $derived(
		panel === 'signup' ? ('signup' as const) : panel === 'forgot' ? ('forgot' as const) : ('signin' as const)
	);
	let accountMode = $derived(
		$auth.ready && $auth.configured && Boolean($auth.user) && !recoveryMode
	);

	$effect(() => {
		if (accountMode) greetingNameInput = get(greetingName);
	});

	async function saveGreetingName() {
		if (greetingNameSaving || !$auth.user) return;
		greetingNameSaving = true;
		try {
			await greetingName.save(greetingNameInput, $auth.user.id);
			toasts.show(translate(lang, 'auth.greetingNameSaved'), 'success');
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
	class:auth-page--account={accountMode}
>
	<div class="lg:hidden">
		<ScreenHeader title={translate(lang, 'auth.title')} backHref={nextPath} />
	</div>
	<header class="page-header auth-page__header">
		<div class="subroute-desktop-head hidden md:block">
			<SubrouteBack href={nextPath} label={backLabel} />
		</div>
		<div class="auth-page__heading">
			<h1 class="page-title hidden md:block">{translate(lang, 'auth.title')}</h1>
			{#if !accountMode}
				<div class="auth-page__toolbar">
					<LanguageSwitcher compact />
				</div>
			{/if}
		</div>
		<p class="page-lead auth-page__lead">{translate(lang, 'auth.lead')}</p>
	</header>

	{#if !$auth.ready}
		<PageSkeleton variant="auth" rows={2} />
	{:else if !$auth.configured}
		<div class="panel text-sm">
			<p class="font-semibold">{translate(lang, 'auth.cloudOffTitle')}</p>
			<p class="mt-2 text-[var(--color-muted)]">
				{translate(lang, 'auth.cloudOffBefore')}
				<a class="underline" href="https://supabase.com" target="_blank" rel="noreferrer"
					>supabase.com</a
				>{translate(lang, 'auth.cloudOffAfter')}
			</p>
		</div>
		<div class="panel mt-3">
			<DataExportSection />
		</div>
	{:else if recoveryMode}
		<form
			class="panel flex flex-col gap-3"
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
				<p class="text-sm text-[var(--color-muted)]">{message}</p>
			{/if}
			<button type="submit" class="btn-primary" disabled={loading}>
				{#if loading}
					<span class="inline-flex items-center gap-2">
						<Spinner size="sm" block={false} />
						{translate(lang, 'auth.wait')}
					</span>
				{:else}
					{translate(lang, 'auth.submitNewPassword')}
				{/if}
			</button>
		</form>
	{:else if $auth.user}
		<div class="auth-account panel">
			<div class="auth-account__identity">
				<div class="auth-profile">
					{#if showProfilePhoto && profileAvatar}
						<img
							class="account-avatar is-photo auth-profile__avatar"
							src={profileAvatar}
							alt=""
							width="64"
							height="64"
							referrerpolicy="no-referrer"
							decoding="async"
							onerror={() => {
								profileAvatarBroken = true;
							}}
						/>
					{:else if profileInitials}
						<span class="account-avatar auth-profile__avatar" aria-hidden="true">{profileInitials}</span>
					{/if}
					<div class="auth-profile__text min-w-0">
						<div class="auth-profile__meta">
							<p class="text-sm text-[var(--color-muted)]">{translate(lang, 'auth.signedInAs')}</p>
							{#if profileProviderLabel}
								<span class="auth-provider-badge">{profileProviderLabel}</span>
							{/if}
						</div>
						{#if profileName}
							<p class="auth-profile__name truncate">{profileName}</p>
						{/if}
						{#if $auth.user.email}
							<p class="text-sm text-[var(--color-muted)] truncate">{$auth.user.email}</p>
						{/if}
					</div>
				</div>
				<p class="auth-account__sync-hint">{translate(lang, 'auth.syncedHint')}</p>
			</div>

			<form
				class="auth-account__section"
				onsubmit={(e) => {
					e.preventDefault();
					void saveGreetingName();
				}}
			>
				<label class="field-label" for="auth-greeting-name">
					{translate(lang, 'auth.greetingNameLabel')}
					<input
						id="auth-greeting-name"
						class="field mt-1 w-full"
						type="text"
						autocomplete="nickname"
						maxlength={GREETING_NAME_MAX}
						placeholder={translate(lang, 'auth.greetingNamePh')}
						bind:value={greetingNameInput}
					/>
				</label>
				<p class="mt-1 text-xs text-[var(--color-muted)]">
					{translate(lang, 'auth.greetingNameHint')}
				</p>
				<button type="submit" class="btn-secondary auth-account__save min-h-11" disabled={greetingNameSaving}>
					{#if greetingNameSaving}
						<span class="inline-flex items-center gap-2">
							<Spinner size="sm" block={false} />
							{translate(lang, 'auth.wait')}
						</span>
					{:else}
						{translate(lang, 'auth.greetingNameSave')}
					{/if}
				</button>
			</form>

			<div class="auth-account__section">
				<p class="auth-prefs__title">{translate(lang, 'settings.interfaceTitle')}</p>
				<div class="auth-prefs__stack">
					<LanguageSwitcher />
					<label class="field-label" for="auth-theme">
						{translate(lang, 'settings.theme')}
						<select
							id="auth-theme"
							class="field mt-1 w-full"
							value={$appTheme}
							onchange={(e) => {
								appTheme.set((e.currentTarget as HTMLSelectElement).value as AppTheme);
							}}
						>
							<option value="dark">{translate(lang, 'settings.themeDark')}</option>
							<option value="light">{translate(lang, 'settings.themeLight')}</option>
						</select>
					</label>
				</div>
				<p class="mt-2 text-xs text-[var(--color-muted)]">{translate(lang, 'settings.themeHint')}</p>
			</div>

			<div class="auth-account__section">
				<p class="auth-prefs__title">{translate(lang, 'settings.sessionTitle')}</p>
				<label class="auth-pref-toggle">
					<span class="auth-pref-toggle__copy">
						<span class="auth-pref-toggle__label">{translate(lang, 'settings.restSound')}</span>
						<span class="auth-pref-toggle__hint">{translate(lang, restSoundHintKey)}</span>
					</span>
					<input
						type="checkbox"
						class="auth-pref-toggle__input"
						checked={$restSoundEnabled}
						onchange={(e) => {
							restSoundEnabled.set((e.currentTarget as HTMLInputElement).checked);
						}}
					/>
				</label>
			</div>

			<DataExportSection />

			<div class="auth-account__actions">
				<button
					type="button"
					class="btn-secondary auth-account__logout min-h-11"
					disabled={loading}
					aria-busy={loading}
					onclick={logout}
				>
					{#if loading}
						<span class="inline-flex items-center gap-2">
							<Spinner size="sm" block={false} />
							{translate(lang, 'auth.wait')}
						</span>
					{:else}
						{translate(lang, 'auth.logout')}
					{/if}
				</button>
			</div>

			<p class="auth-account__legal">
				<span class="auth-account__legal-label">{translate(lang, 'auth.privacyHint')}</span>
				<a class="auth-account__legal-link" href="/privacy">{translate(lang, 'privacy.link')}</a>
			</p>

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
					<button
						type="button"
						class="btn-danger auth-danger-zone__trigger min-h-11"
						disabled={loading}
						onclick={openDeleteConfirm}
					>
						{translate(lang, 'auth.deleteButton')}
					</button>
				{:else}
					<div
						class="auth-danger-zone__confirm"
						role="group"
						aria-labelledby="auth-delete-confirm-hint"
					>
						<label class="field-label" for="auth-delete-confirm">
							<span id="auth-delete-confirm-hint">
								{translate(lang, 'auth.deleteConfirmHint', { word: deleteConfirmWord })}
							</span>
							<input
								id="auth-delete-confirm"
								class="field mt-1 w-full"
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
						</label>
						<div class="auth-danger-zone__confirm-actions">
							<button
								type="button"
								class="btn-secondary min-h-11"
								disabled={loading}
								onclick={cancelDeleteConfirm}
							>
								{translate(lang, 'auth.deleteCancel')}
							</button>
							<button
								type="button"
								class="btn-danger min-h-11"
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
							</button>
						</div>
					</div>
				{/if}
			</div>
		</div>
	{:else if panel === 'check-email'}
		<div class="panel flex flex-col gap-3">
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
			<button type="button" class="btn-secondary" onclick={() => setPanel('signin')}>
				{translate(lang, 'auth.backToSignIn')}
			</button>
		</div>
	{:else}
		<div class="auth-card panel flex flex-col gap-4">
			{#if panel !== 'forgot'}
				<div class="auth-segments" role="tablist" aria-label={translate(lang, 'auth.methodAria')}>
					<button
						type="button"
						class="auth-segment"
						class:is-active={authMethod === 'password'}
						role="tab"
						aria-selected={authMethod === 'password'}
						onclick={() => setAuthMethod('password')}
					>
						{translate(lang, 'auth.passwordTab')}
					</button>
					<button
						type="button"
						class="auth-segment"
						class:is-active={authMethod === 'magic'}
						role="tab"
						aria-selected={authMethod === 'magic'}
						onclick={() => setAuthMethod('magic')}
					>
						{translate(lang, 'auth.magicTab')}
					</button>
				</div>
			{/if}

			{#if authMethod === 'password' && panel !== 'forgot'}
				<div class="auth-segments auth-segments--sub" role="tablist" aria-label={translate(lang, 'auth.modeAria')}>
					<button
						type="button"
						class="auth-segment auth-segment--sub"
						class:is-active={passwordMode === 'signin'}
						role="tab"
						aria-selected={passwordMode === 'signin'}
						onclick={() => setPasswordMode('signin')}
					>
						{translate(lang, 'auth.signInTab')}
					</button>
					<button
						type="button"
						class="auth-segment auth-segment--sub"
						class:is-active={passwordMode === 'signup'}
						role="tab"
						aria-selected={passwordMode === 'signup'}
						onclick={() => setPasswordMode('signup')}
					>
						{translate(lang, 'auth.signUpTab')}
					</button>
				</div>
			{/if}

			{#if panel === 'magic'}
				<form
					class="auth-form flex flex-col gap-3"
					onsubmit={(e) => {
						e.preventDefault();
						void submitMagic();
					}}
				>
					<p class="text-sm leading-relaxed text-[var(--color-muted)]">{translate(lang, 'auth.magicLead')}</p>
					<label class="field-label">
						{translate(lang, 'auth.email')}
						<input
							class="field mt-1 w-full"
							class:is-invalid={fieldsInvalid}
							aria-invalid={fieldsInvalid}
							type="email"
							required
							autocomplete="email"
							inputmode="email"
							placeholder={translate(lang, 'auth.emailPh')}
							bind:value={email}
						/>
					</label>
					{#if message}
						<p class="text-sm text-[var(--color-muted)]">{message}</p>
					{/if}
					<button type="submit" class="btn-primary btn-block min-h-11" disabled={loading}>
						{#if loading}
							<span class="inline-flex items-center justify-center gap-2">
								<Spinner size="sm" block={false} />
								{translate(lang, 'auth.wait')}
							</span>
						{:else}
							{translate(lang, 'auth.submitMagic')}
						{/if}
					</button>
				</form>
			{:else if passwordMode === 'signin' || passwordMode === 'signup'}
				<form
					class="auth-form flex flex-col gap-3"
					onsubmit={(e) => {
						e.preventDefault();
						void submitPassword();
					}}
				>
					<label class="field-label">
						{translate(lang, 'auth.email')}
						<input
							class="field mt-1 w-full"
							class:is-invalid={fieldsInvalid}
							aria-invalid={fieldsInvalid}
							type="email"
							required
							autocomplete="email"
							inputmode="email"
							placeholder={translate(lang, 'auth.emailPh')}
							bind:value={email}
						/>
					</label>
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
						<button
							type="button"
							class="btn-link self-start text-sm"
							onclick={() => setPanel('forgot')}
						>
							{translate(lang, 'auth.forgot')}
						</button>
					{/if}

					{#if message}
						<p class="text-sm text-[var(--color-muted)]">{message}</p>
					{/if}

					{#if passwordMode === 'signup'}
						<p class="text-sm text-[var(--color-muted)]">
							{translate(lang, 'auth.privacyHint')}
							<a class="btn-link" href="/privacy">{translate(lang, 'privacy.link')}</a>
						</p>
					{/if}

					<button type="submit" class="btn-primary btn-block min-h-11" disabled={loading}>
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
					</button>
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
					<label class="field-label">
						{translate(lang, 'auth.email')}
						<input
							class="field mt-1 w-full"
							class:is-invalid={fieldsInvalid}
							aria-invalid={fieldsInvalid}
							type="email"
							required
							autocomplete="email"
							inputmode="email"
							placeholder={translate(lang, 'auth.emailPh')}
							bind:value={email}
						/>
					</label>
					{#if message}
						<p class="text-sm text-[var(--color-muted)]">{message}</p>
					{/if}
					<button type="submit" class="btn-primary btn-block min-h-11" disabled={loading}>
						{#if loading}
							<span class="inline-flex items-center justify-center gap-2">
								<Spinner size="sm" block={false} />
								{translate(lang, 'auth.wait')}
							</span>
						{:else}
							{translate(lang, 'auth.submitReset')}
						{/if}
					</button>
					<button type="button" class="btn-secondary btn-block min-h-11" onclick={() => setPanel('signin')}>
						{translate(lang, 'auth.backToSignIn')}
					</button>
				</form>
			{/if}

			{#if googleOAuthEnabled && panel !== 'forgot'}
				<div class="auth-divider" aria-hidden="true">
					<span>{translate(lang, 'auth.or')}</span>
				</div>

				<button
					type="button"
					class="btn-secondary inline-flex w-full items-center justify-center gap-2 min-h-11"
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
				</button>
			{/if}
		</div>
		<div class="panel mt-3">
			<DataExportSection />
		</div>
	{/if}
</section>
