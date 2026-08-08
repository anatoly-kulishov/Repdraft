<script lang="ts">
	import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
	import { translate } from '$lib/i18n/messages';
	import { auth } from '$lib/stores/auth';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';

	let mode = $state<'signin' | 'signup'>('signin');
	let email = $state('');
	let password = $state('');
	let loading = $state(false);
	let message = $state<string | null>(null);
	let lang = $derived($resolvedLocale);

	async function submit() {
		if (!$auth.configured) {
			toasts.show('Supabase ещё не настроен — см. README', 'error');
			return;
		}
		loading = true;
		message = null;
		try {
			if (mode === 'signup') {
				await auth.signUp(email.trim(), password);
				message =
					'Аккаунт создан. Если включено подтверждение email — проверьте почту, иначе можно сразу войти.';
				toasts.show('Регистрация выполнена', 'success');
				mode = 'signin';
			} else {
				await auth.signIn(email.trim(), password);
				toasts.show('Вы вошли — данные синхронизируются', 'success');
			}
		} catch (err) {
			const text = err instanceof Error ? err.message : 'Ошибка входа';
			message = text;
			toasts.show(text, 'error');
		} finally {
			loading = false;
		}
	}

	async function logout() {
		try {
			await auth.signOut();
			toasts.show('Вы вышли', 'info');
		} catch (err) {
			toasts.show(err instanceof Error ? err.message : 'Ошибка выхода', 'error');
		}
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
		<p class="text-sm text-[var(--color-muted)]">{translate(lang, 'auth.loading')}</p>
	{:else if !$auth.configured}
		<div class="panel text-sm">
			<p class="font-semibold">{translate(lang, 'auth.cloudOffTitle')}</p>
			<p class="mt-2 text-[var(--color-muted)]">
				Создайте проект на
				<a class="underline" href="https://supabase.com" target="_blank" rel="noreferrer">supabase.com</a>,
				выполните SQL из <code class="text-[var(--color-ink)]">supabase/schema.sql</code>, скопируйте
				<code class="text-[var(--color-ink)]">.env.example</code> в
				<code class="text-[var(--color-ink)]">.env</code> и укажите URL + anon key. Подробности в README.
			</p>
		</div>
	{:else if $auth.user}
		<div class="panel">
			<p class="text-sm text-[var(--color-muted)]">{translate(lang, 'auth.signedInAs')}</p>
			<p class="font-semibold">{$auth.user.email}</p>
			<p class="mt-2 text-xs text-[var(--color-muted)]">{translate(lang, 'auth.syncedHint')}</p>
			<button type="button" class="btn-secondary mt-4" onclick={logout}>
				{translate(lang, 'auth.logout')}
			</button>
		</div>
	{:else}
		<form
			class="panel flex flex-col gap-3"
			onsubmit={(e) => {
				e.preventDefault();
				void submit();
			}}
		>
			<div class="flex gap-2 text-sm">
				<button
					type="button"
					class={mode === 'signin' ? 'font-semibold text-[var(--color-accent)]' : 'text-[var(--color-muted)]'}
					onclick={() => (mode = 'signin')}
				>
					{translate(lang, 'auth.signInTab')}
				</button>
				<span class="text-[var(--color-border)]">|</span>
				<button
					type="button"
					class={mode === 'signup' ? 'font-semibold text-[var(--color-accent)]' : 'text-[var(--color-muted)]'}
					onclick={() => (mode = 'signup')}
				>
					{translate(lang, 'auth.signUpTab')}
				</button>
			</div>

			<label class="field-label">
				{translate(lang, 'auth.email')}
				<input class="field mt-1 w-full" type="email" required autocomplete="email" bind:value={email} />
			</label>
			<label class="field-label">
				{translate(lang, 'auth.password')}
				<input
					class="field mt-1 w-full"
					type="password"
					required
					minlength="6"
					autocomplete={mode === 'signup' ? 'new-password' : 'current-password'}
					bind:value={password}
				/>
			</label>

			{#if message}
				<p class="text-sm text-[var(--color-muted)]">{message}</p>
			{/if}

			<button type="submit" class="btn-primary" disabled={loading}>
				{loading
					? translate(lang, 'auth.wait')
					: mode === 'signup'
						? translate(lang, 'auth.submitSignUp')
						: translate(lang, 'auth.submitSignIn')}
			</button>
		</form>
	{/if}
</section>
