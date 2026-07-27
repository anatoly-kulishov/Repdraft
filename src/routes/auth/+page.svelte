<script lang="ts">
	import { auth } from '$lib/stores/auth';
	import { toasts } from '$lib/stores/toasts';

	let mode = $state<'signin' | 'signup'>('signin');
	let email = $state('');
	let password = $state('');
	let loading = $state(false);
	let message = $state<string | null>(null);

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
	<title>Аккаунт — Repdraft</title>
</svelte:head>

<section class="mx-auto max-w-md">
	<h1 class="font-[family-name:var(--font-display)] text-2xl md:text-3xl">Аккаунт</h1>
	<p class="mt-2 text-sm text-[var(--color-muted)]">
		Войдите, чтобы планы и рекорды были доступны с телефона и компьютера в одном аккаунте.
	</p>

	{#if !$auth.ready}
		<p class="mt-6 text-sm text-[var(--color-muted)]">Загрузка…</p>
	{:else if !$auth.configured}
		<div class="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm">
			<p class="font-semibold">Облако пока не подключено</p>
			<p class="mt-2 text-[var(--color-muted)]">
				Создайте проект на
				<a class="underline" href="https://supabase.com" target="_blank" rel="noreferrer">supabase.com</a>,
				выполните SQL из <code class="text-[var(--color-ink)]">supabase/schema.sql</code>, скопируйте
				<code class="text-[var(--color-ink)]">.env.example</code> в
				<code class="text-[var(--color-ink)]">.env</code> и укажите URL + anon key. Подробности в README.
			</p>
			<p class="mt-2 text-[var(--color-muted)]">
				Без этого приложение работает локально на устройстве (как раньше).
			</p>
		</div>
	{:else if $auth.user}
		<div class="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
			<p class="text-sm text-[var(--color-muted)]">Вы вошли как</p>
			<p class="font-semibold">{$auth.user.email}</p>
			<p class="mt-2 text-xs text-[var(--color-muted)]">
				Планы и рекорды сохраняются в облаке и доступны с любого устройства.
			</p>
			<button type="button" class="btn-secondary mt-4" onclick={logout}>Выйти</button>
		</div>
	{:else}
		<form class="mt-6 flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4" onsubmit={(e) => { e.preventDefault(); void submit(); }}>
			<div class="flex gap-2 text-sm">
				<button
					type="button"
					class={mode === 'signin' ? 'font-semibold text-[var(--color-accent)]' : 'text-[var(--color-muted)]'}
					onclick={() => (mode = 'signin')}
				>
					Вход
				</button>
				<span class="text-[var(--color-border)]">|</span>
				<button
					type="button"
					class={mode === 'signup' ? 'font-semibold text-[var(--color-accent)]' : 'text-[var(--color-muted)]'}
					onclick={() => (mode = 'signup')}
				>
					Регистрация
				</button>
			</div>

			<label class="text-xs font-medium text-[var(--color-muted)]">
				Email
				<input class="field mt-1 w-full" type="email" required autocomplete="email" bind:value={email} />
			</label>
			<label class="text-xs font-medium text-[var(--color-muted)]">
				Пароль
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
				{loading ? 'Подождите…' : mode === 'signup' ? 'Зарегистрироваться' : 'Войти'}
			</button>
		</form>
	{/if}
</section>
