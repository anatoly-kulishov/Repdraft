<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import AttributionFooter from '$lib/components/AttributionFooter.svelte';
	import AccountChip from '$lib/components/AccountChip.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import ToastStack from '$lib/components/ToastStack.svelte';
	import { translate } from '$lib/i18n/messages';
	import { auth } from '$lib/stores/auth';
	import { draft, draftHydrated } from '$lib/stores/draft';
	import { live } from '$lib/stores/live';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';
	import { page } from '$app/stores';
	import { onNavigate } from '$app/navigation';
	import { onMount } from 'svelte';

	let { children } = $props();

	let draftCount = $derived($draftHydrated ? $draft.exercises.length : 0);
	let path = $derived($page.url.pathname);
	let lang = $derived($resolvedLocale);

	onNavigate((navigation) => {
		if (typeof document === 'undefined' || !document.startViewTransition) return;
		return new Promise<void>((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});

	onMount(() => {
		draft.hydrate();
		live.hydrate();
		void auth.init();
	});

	function isActive(href: string): boolean {
		return href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`);
	}

	function navClass(href: string): string {
		return isActive(href) ? 'nav-link' : 'nav-link';
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="manifest" href="/manifest.webmanifest" />
	<meta name="theme-color" content="#0f766e" />
	<meta name="apple-mobile-web-app-title" content="Repdraft" />
	<title>Repdraft</title>
</svelte:head>

<div class="app-shell flex min-h-dvh flex-col">
	<a class="skip-link" href="#main-content">{translate(lang, 'a11y.skip')}</a>
	<header
		class="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_92%,white)] pt-[var(--safe-top)] backdrop-blur"
	>
		<div class="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 md:h-16 md:px-6">
			<Logo />
			<div class="flex items-center gap-3 md:gap-5">
				<nav class="hidden items-center gap-4 text-sm md:flex lg:gap-5">
					<a class={navClass('/')} data-active={isActive('/')} href="/">{translate(lang, 'nav.catalog')}</a>
					<a
						class={`relative ${navClass('/builder')}`}
						data-active={isActive('/builder')}
						href="/builder"
					>
						{translate(lang, 'nav.builder')}
						{#if draftCount > 0}
							<span
								class="badge-pop ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-accent)] px-1.5 text-[11px] font-bold text-white"
							>
								{draftCount}
							</span>
						{/if}
					</a>
					<a
						class={navClass('/workouts')}
						data-active={isActive('/workouts')}
						href="/workouts">{translate(lang, 'nav.workouts')}</a
					>
					<a
						class={navClass('/records')}
						data-active={isActive('/records')}
						href="/records">{translate(lang, 'nav.records')}</a
					>
					<AccountChip active={isActive('/auth')} />
				</nav>
				<div class="md:hidden">
					<AccountChip active={isActive('/auth')} />
				</div>
			</div>
		</div>
	</header>

	<main
		id="main-content"
		class="mx-auto w-full max-w-6xl flex-1 px-4 py-4 pb-[calc(var(--tabbar-h)+var(--safe-bottom)+1.25rem)] md:px-6 md:py-6 md:pb-8"
		tabindex="-1"
	>
		{@render children()}
	</main>

	<div class="hidden md:block">
		<AttributionFooter />
	</div>

	<nav
		class="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_96%,white)] pb-[var(--safe-bottom)] backdrop-blur md:hidden"
		aria-label={translate(lang, 'nav.main')}
	>
		<div class="mx-auto grid h-[var(--tabbar-h)] max-w-lg grid-cols-4 px-1">
			<a
				class="tab-link relative"
				data-active={isActive('/')}
				href="/"
				aria-current={isActive('/') ? 'page' : undefined}
			>
				<svg viewBox="0 0 24 24" aria-hidden="true"
					><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect
						x="14"
						y="3"
						width="7"
						height="7"
						rx="1.5"
					/><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect
						x="14"
						y="14"
						width="7"
						height="7"
						rx="1.5"
					/></svg
				>
				{translate(lang, 'nav.catalog')}
			</a>
			<a
				class="tab-link relative"
				data-active={isActive('/builder')}
				href="/builder"
				aria-current={isActive('/builder') ? 'page' : undefined}
			>
				<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
				{translate(lang, 'nav.draft')}
				{#if draftCount > 0}
					<span
						class="absolute right-[18%] top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-accent)] px-1 text-[10px] font-bold text-white"
					>
						{draftCount}
					</span>
				{/if}
			</a>
			<a
				class="tab-link"
				data-active={isActive('/workouts')}
				href="/workouts"
				aria-current={isActive('/workouts') ? 'page' : undefined}
			>
				<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10" /></svg>
				{translate(lang, 'nav.plans')}
			</a>
			<a
				class="tab-link"
				data-active={isActive('/records')}
				href="/records"
				aria-current={isActive('/records') ? 'page' : undefined}
			>
				<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 21h8M12 17V3M7 8l5-5 5 5" /></svg>
				{translate(lang, 'nav.records')}
			</a>
		</div>
	</nav>
</div>

<ToastStack items={$toasts} />
