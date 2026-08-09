<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
	import PageSkeleton from '$lib/components/PageSkeleton.svelte';
	import PasswordField from '$lib/components/PasswordField.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import {
		authErrorMessageKey,
		passwordsMatch,
		safeRedirectPath
	} from '$lib/domain/authFlow';
	import { translate, translateError } from '$lib/i18n/messages';
	import { auth } from '$lib/stores/auth';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';

	type Panel = 'signin' | 'signup' | 'magic' | 'forgot' | 'check-email';

	let panel = $state<Panel>('signin');
	let email = $state('');
	let password = $state('');
	let passwordConfirm = $state('');
	let loading = $state(false);
	let message = $state<string | null>(null);
	let checkEmailKind = $state<'signup' | 'magic' | 'reset'>('signup');
	let redirected = $state(false);

	let lang = $derived($resolvedLocale);
	let nextPath = $derived(safeRedirectPath($page.url.searchParams.get('next')));
	let recoveryMode = $derived($auth.passwordRecovery);

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
		try {
			if (panel === 'signup') {
				if (!passwordsMatch(password, passwordConfirm)) {
					throw new Error('auth.errors.passwordMismatch');
				}
				const { session } = await auth.signUp(email.trim(), password, nextPath);
				if (session) {
					toasts.show(translate(lang, 'auth.signinToast'), 'success');
					redirected = true;
					await goto(nextPath);
					return;
				}
				toasts.show(translate(lang, 'auth.signupToast'), 'success');
				openCheckEmail('signup');
			} else {
				await auth.signIn(email.trim(), password);
				toasts.show(translate(lang, 'auth.signinToast'), 'success');
				redirected = true;
				await goto(nextPath);
			}
		} catch (err) {
			const text = mapErr(err);
			message = text;
			toasts.show(text, 'error');
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
		try {
			await auth.signInWithOtp(email.trim(), nextPath);
			toasts.show(translate(lang, 'auth.magicToast'), 'success');
			openCheckEmail('magic');
		} catch (err) {
			const text = mapErr(err);
			message = text;
			toasts.show(text, 'error');
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
		try {
			await auth.resetPasswordForEmail(email.trim());
			toasts.show(translate(lang, 'auth.resetToast'), 'success');
			openCheckEmail('reset');
		} catch (err) {
			const text = mapErr(err);
			message = text;
			toasts.show(text, 'error');
		} finally {
			loading = false;
		}
	}

	async function submitRecovery() {
		loading = true;
		message = null;
		try {
			if (!passwordsMatch(password, passwordConfirm)) {
				throw new Error('auth.errors.passwordMismatch');
			}
			await auth.updatePassword(password);
			toasts.show(translate(lang, 'auth.passwordUpdated'), 'success');
			password = '';
			passwordConfirm = '';
			redirected = true;
			await goto(nextPath);
		} catch (err) {
			const text = mapErr(err);
			message = text;
			toasts.show(text, 'error');
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
		try {
			await auth.signOut();
			toasts.show(translate(lang, 'auth.signedOut'), 'info');
		} catch (err) {
			toasts.show(mapErr(err) || translateError(lang, err, 'auth.signOutError'), 'error');
		}
	}

	function setPanel(next: Panel) {
		panel = next;
		message = null;
	}
</script>

<svelte:head>
	<title>{translate(lang, 'auth.title')} — Repdraft</title>
</svelte:head>

<section class="mx-auto max-w-md">
	<div class="page-header">
		<h1 class="page-title">{translate(lang, 'auth.title')}</h1>
		<p class="page-lead">{translate(lang, 'auth.lead')}</p>
	</div>

	<div class="panel mb-4">
		<LanguageSwitcher />
		<p class="mt-2 text-xs text-[var(--color-muted)]">{translate(lang, 'lang.hint')}</p>
	</div>

	{#if !$auth.ready}
		<PageSkeleton rows={2} showField={true} />
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
			/>
			<PasswordField
				bind:value={passwordConfirm}
				label={translate(lang, 'auth.passwordConfirm')}
				placeholder={translate(lang, 'auth.passwordConfirmPh')}
				autocomplete="new-password"
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
		<div class="panel">
			<p class="text-sm text-[var(--color-muted)]">{translate(lang, 'auth.signedInAs')}</p>
			<p class="font-semibold">{$auth.user.email}</p>
			<p class="mt-2 text-xs text-[var(--color-muted)]">{translate(lang, 'auth.syncedHint')}</p>
			<a class="btn-primary mt-4 inline-flex" href={nextPath}>{translate(lang, 'auth.continue')}</a>
			<button type="button" class="btn-secondary mt-2" onclick={logout}>
				{translate(lang, 'auth.logout')}
			</button>
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
		<div class="panel flex flex-col gap-3">
			<button
				type="button"
				class="btn-secondary inline-flex items-center justify-center gap-2"
				disabled={loading}
				onclick={() => void google()}
			>
				<svg viewBox="0 0 24 24" class="h-4 w-4" aria-hidden="true">
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

			<div class="flex items-center gap-2 text-xs text-[var(--color-muted)]">
				<span class="h-px flex-1 bg-[var(--color-border)]"></span>
				<span>{translate(lang, 'auth.orEmail')}</span>
				<span class="h-px flex-1 bg-[var(--color-border)]"></span>
			</div>

			<div class="flex flex-wrap gap-2 text-sm">
				<button
					type="button"
					class={panel === 'signin' || panel === 'signup' || panel === 'forgot'
						? 'font-semibold text-[var(--color-accent)]'
						: 'text-[var(--color-muted)]'}
					onclick={() => setPanel(panel === 'signup' ? 'signup' : 'signin')}
				>
					{translate(lang, 'auth.passwordTab')}
				</button>
				<span class="text-[var(--color-border)]">|</span>
				<button
					type="button"
					class={panel === 'magic' ? 'font-semibold text-[var(--color-accent)]' : 'text-[var(--color-muted)]'}
					onclick={() => setPanel('magic')}
				>
					{translate(lang, 'auth.magicTab')}
				</button>
			</div>

			{#if panel === 'signin' || panel === 'signup'}
				<div class="flex gap-2 text-sm">
					<button
						type="button"
						class={panel === 'signin'
							? 'font-semibold text-[var(--color-accent)]'
							: 'text-[var(--color-muted)]'}
						onclick={() => setPanel('signin')}
					>
						{translate(lang, 'auth.signInTab')}
					</button>
					<span class="text-[var(--color-border)]">|</span>
					<button
						type="button"
						class={panel === 'signup'
							? 'font-semibold text-[var(--color-accent)]'
							: 'text-[var(--color-muted)]'}
						onclick={() => setPanel('signup')}
					>
						{translate(lang, 'auth.signUpTab')}
					</button>
				</div>

				<form
					class="flex flex-col gap-3"
					onsubmit={(e) => {
						e.preventDefault();
						void submitPassword();
					}}
				>
					<label class="field-label">
						{translate(lang, 'auth.email')}
						<input
							class="field mt-1 w-full"
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
						autocomplete={panel === 'signup' ? 'new-password' : 'current-password'}
					/>
					{#if panel === 'signup'}
						<PasswordField
							bind:value={passwordConfirm}
							label={translate(lang, 'auth.passwordConfirm')}
							placeholder={translate(lang, 'auth.passwordConfirmPh')}
							autocomplete="new-password"
						/>
					{/if}

					{#if panel === 'signin'}
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

					<button type="submit" class="btn-primary" disabled={loading}>
						{#if loading}
							<span class="inline-flex items-center gap-2">
								<Spinner size="sm" block={false} />
								{translate(lang, 'auth.wait')}
							</span>
						{:else}
							{panel === 'signup'
								? translate(lang, 'auth.submitSignUp')
								: translate(lang, 'auth.submitSignIn')}
						{/if}
					</button>
				</form>
			{:else if panel === 'magic'}
				<form
					class="flex flex-col gap-3"
					onsubmit={(e) => {
						e.preventDefault();
						void submitMagic();
					}}
				>
					<p class="text-sm text-[var(--color-muted)]">{translate(lang, 'auth.magicLead')}</p>
					<label class="field-label">
						{translate(lang, 'auth.email')}
						<input
							class="field mt-1 w-full"
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
					<button type="submit" class="btn-primary" disabled={loading}>
						{#if loading}
							<span class="inline-flex items-center gap-2">
								<Spinner size="sm" block={false} />
								{translate(lang, 'auth.wait')}
							</span>
						{:else}
							{translate(lang, 'auth.submitMagic')}
						{/if}
					</button>
				</form>
			{:else if panel === 'forgot'}
				<form
					class="flex flex-col gap-3"
					onsubmit={(e) => {
						e.preventDefault();
						void submitForgot();
					}}
				>
					<p class="text-sm text-[var(--color-muted)]">{translate(lang, 'auth.forgotLead')}</p>
					<label class="field-label">
						{translate(lang, 'auth.email')}
						<input
							class="field mt-1 w-full"
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
					<button type="submit" class="btn-primary" disabled={loading}>
						{#if loading}
							<span class="inline-flex items-center gap-2">
								<Spinner size="sm" block={false} />
								{translate(lang, 'auth.wait')}
							</span>
						{:else}
							{translate(lang, 'auth.submitReset')}
						{/if}
					</button>
					<button type="button" class="btn-ghost" onclick={() => setPanel('signin')}>
						{translate(lang, 'auth.backToSignIn')}
					</button>
				</form>
			{/if}
		</div>
	{/if}
</section>
