<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import AttributionFooter from '$lib/components/AttributionFooter.svelte';
	import ToastStack from '$lib/components/ToastStack.svelte';
	import { auth } from '$lib/stores/auth';
	import { draft } from '$lib/stores/draft';
	import { toasts } from '$lib/stores/toasts';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	let { children } = $props();

	let draftCount = $derived($draft.exercises.length);
	let path = $derived($page.url.pathname);
	let accountLabel = $derived(
		!$auth.configured ? 'Аккаунт' : $auth.user ? 'Профиль' : 'Войти'
	);

	onMount(() => {
		void auth.init();
	});

	function navClass(href: string): string {
		const active =
			href === '/'
				? path === '/'
				: path === href || path.startsWith(`${href}/`);
		return active
			? 'text-[var(--color-accent)] font-semibold'
			: 'text-[var(--color-muted)] hover:text-[var(--color-ink)]';
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Repdraft</title>
</svelte:head>

<div class="flex min-h-screen flex-col pb-16 md:pb-0">
	<header class="border-b border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_88%,white)] backdrop-blur">
		<div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
			<a href="/" class="font-[family-name:var(--font-display)] text-2xl font-800 tracking-tight text-[var(--color-ink)] md:text-3xl">
				Repdraft
			</a>
			<nav class="hidden items-center gap-4 text-sm md:flex lg:gap-5">
				<a class={navClass('/')} href="/">Каталог</a>
				<a class={`relative ${navClass('/builder')}`} href="/builder">
					Конструктор
					{#if draftCount > 0}
						<span
							class="badge-pop ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-accent)] px-1.5 text-[11px] font-bold text-white"
						>
							{draftCount}
						</span>
					{/if}
				</a>
				<a class={navClass('/workouts')} href="/workouts">Мои тренировки</a>
				<a class={navClass('/records')} href="/records">Рекорды</a>
				<a class={navClass('/auth')} href="/auth">{accountLabel}</a>
			</nav>
			<a class={`text-sm md:hidden ${navClass('/auth')}`} href="/auth">{accountLabel}</a>
		</div>
	</header>

	<main class="mx-auto w-full max-w-6xl flex-1 px-4 py-4 md:px-6 md:py-6">
		{@render children()}
	</main>

	<AttributionFooter />

	<nav
		class="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-1 py-2 text-[11px] md:hidden"
	>
		<a class={`flex flex-col items-center gap-1 py-1 ${navClass('/')}`} href="/">Каталог</a>
		<a class={`relative flex flex-col items-center gap-1 py-1 ${navClass('/builder')}`} href="/builder">
			Черновик
			{#if draftCount > 0}
				<span class="absolute right-2 top-0 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-accent)] px-1 text-[10px] font-bold text-white">
					{draftCount}
				</span>
			{/if}
		</a>
		<a class={`flex flex-col items-center gap-1 py-1 ${navClass('/workouts')}`} href="/workouts">Планы</a>
		<a class={`flex flex-col items-center gap-1 py-1 ${navClass('/records')}`} href="/records">Рекорды</a>
	</nav>
</div>

<ToastStack items={$toasts} />
