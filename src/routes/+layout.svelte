<script lang="ts">
	import './layout.css';
	import { appTheme } from '$lib/stores/theme';
	import { THEME_META_COLORS } from '$lib/domain/theme';
	import AppSidebar from '$lib/components/AppSidebar.svelte';
	import AttributionFooter from '$lib/components/AttributionFooter.svelte';
	import AccountChip from '$lib/components/AccountChip.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import ToastStack from '$lib/components/ToastStack.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SIDEBAR } from '$lib/components/icons/sizes';
	import { Dumbbell, House, Library, Moon, Sun } from '@lucide/svelte';
	import { translate } from '$lib/i18n/messages';
	import { auth } from '$lib/stores/auth';
	import { draft } from '$lib/stores/draft';
	import { live } from '$lib/stores/live';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';
	import { page } from '$app/stores';
	import { onNavigate } from '$app/navigation';
	import { onMount } from 'svelte';

	let { children } = $props();

	let path = $derived($page.url.pathname);
	let lang = $derived($resolvedLocale);
	let themeColor = $derived(THEME_META_COLORS[$appTheme]);
	let isLight = $derived($appTheme === 'light');
	function mobileFlowChrome(pathname: string): boolean {
		if (pathname.startsWith('/catalog/')) return true;
		if (pathname.startsWith('/live/')) return true;
		if (pathname.startsWith('/builder')) return true;
		if (pathname.startsWith('/exercise/')) return true;
		if (pathname.startsWith('/auth')) return true;
		if (pathname === '/settings') return true;
		if (pathname === '/exercises/saved') return true;
		if (pathname === '/workouts/summary') return true;
		if (pathname.startsWith('/workouts/history/')) return true;
		if (/^\/workouts\/[^/]+$/.test(pathname)) return true;
		return false;
	}

	let hideMobileHeader = $derived(mobileFlowChrome(path));

	onNavigate((navigation) => {
		if (typeof document === 'undefined' || !document.startViewTransition) return;
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
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

		const recoverFixedChrome = () => {
			if (
				document.body.style.overflow === 'hidden' &&
				!document.querySelector('[aria-modal="true"]')
			) {
				document.body.style.overflow = '';
			}
			const y = window.scrollY;
			window.scrollTo(0, y === 0 ? 1 : y - 1);
			window.scrollTo(0, y);
		};

		const onVisible = () => {
			if (document.visibilityState === 'visible') recoverFixedChrome();
		};
		document.addEventListener('visibilitychange', onVisible);
		window.addEventListener('pageshow', recoverFixedChrome);
		window.visualViewport?.addEventListener('resize', recoverFixedChrome);

		return () => {
			document.removeEventListener('visibilitychange', onVisible);
			window.removeEventListener('pageshow', recoverFixedChrome);
			window.visualViewport?.removeEventListener('resize', recoverFixedChrome);
		};
	});

	function isActive(href: string): boolean {
		if (href === '/') return path === '/';
		if (href === '/exercises') {
			return (
				path === '/exercises' ||
				path.startsWith('/exercises/') ||
				path.startsWith('/catalog/') ||
				path.startsWith('/exercise/')
			);
		}
		if (href === '/workouts') {
			return (
				path === '/workouts' ||
				path.startsWith('/workouts/') ||
				path.startsWith('/builder') ||
				path.startsWith('/live/')
			);
		}
		if (href === '/settings') return path === '/settings';
		if (href === '/auth') return path === '/auth' || path.startsWith('/auth/');
		return path === href || path.startsWith(`${href}/`);
	}
</script>

<svelte:head>
	<link rel="icon" href="/icon-adaptive.svg" type="image/svg+xml" />
	<link rel="manifest" href="/manifest.webmanifest" />
	<meta name="theme-color" content={themeColor} />
	<meta name="apple-mobile-web-app-title" content="Repdraft" />
	<title>Repdraft</title>
</svelte:head>

<a class="skip-link" href="#main-content">{translate(lang, 'a11y.skip')}</a>
<div class="app-shell" class:app-shell--immersive={hideMobileHeader}>
	<AppSidebar {path} {isActive} />

	<div class="shell-body flex min-h-dvh min-w-0 flex-1 flex-col">
		<header
			class="shell-header-mobile sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-surface)] pt-[var(--safe-top)]"
			class:shell-header-mobile-hidden={hideMobileHeader}
		>
			<div
				class="mx-auto flex h-14 w-full max-w-[var(--page-content-max)] items-center justify-between gap-3 shell-header-pad"
			>
				<Logo />
				<div class="flex items-center gap-1">
					<button
						type="button"
						class="btn-ghost shell-theme-toggle"
						onclick={() => appTheme.toggle()}
						aria-label={translate(lang, isLight ? 'settings.themeDark' : 'settings.themeLight')}
						title={translate(lang, isLight ? 'settings.themeDark' : 'settings.themeLight')}
					>
						{#if isLight}
							<Moon size={ICON_SIDEBAR} strokeWidth={1.75} aria-hidden="true" />
						{:else}
							<Sun size={ICON_SIDEBAR} strokeWidth={1.75} aria-hidden="true" />
						{/if}
					</button>
					<AccountChip active={isActive('/auth')} />
				</div>
			</div>
		</header>

		<main
			id="main-content"
			class="shell-main mx-auto w-full min-w-0 flex-1 overflow-x-hidden overflow-x-clip"
			class:shell-main--subroute={hideMobileHeader}
			class:shell-main--flow={hideMobileHeader}
			tabindex="-1"
		>
			{@render children()}
		</main>

		<div class="shell-footer-pad">
			<AttributionFooter />
		</div>
	</div>
</div>

<nav
	class="shell-nav-tabbar fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-border)] bg-[var(--color-surface)] pb-[var(--safe-bottom)]"
	class:shell-nav-tabbar-hidden={hideMobileHeader}
	aria-label={translate(lang, 'nav.main')}
>
	<div class="mx-auto grid h-[var(--tabbar-h)] max-w-lg grid-cols-3 px-1">
		<a
			class="tab-link"
			data-active={isActive('/')}
			href="/"
			aria-current={isActive('/') ? 'page' : undefined}
		>
			<LucideIcon icon={House} size={ICON_SIDEBAR} />
			{translate(lang, 'nav.tabHome')}
		</a>
		<a
			class="tab-link"
			data-active={isActive('/workouts')}
			href="/workouts"
			aria-current={isActive('/workouts') ? 'page' : undefined}
		>
			<LucideIcon icon={Dumbbell} size={ICON_SIDEBAR} />
			{translate(lang, 'nav.workouts')}
		</a>
		<a
			class="tab-link"
			data-active={isActive('/exercises')}
			href="/exercises"
			aria-current={isActive('/exercises') ? 'page' : undefined}
		>
			<LucideIcon icon={Library} size={ICON_SIDEBAR} />
			{translate(lang, 'nav.exercises')}
		</a>
	</div>
</nav>

<ToastStack items={$toasts} />
