<script lang="ts">
	import './layout.css';
	import { appTheme } from '$lib/stores/theme';
	import AppSidebar from '$lib/components/AppSidebar.svelte';
	import AttributionFooter from '$lib/components/AttributionFooter.svelte';
	import AccountChip from '$lib/components/AccountChip.svelte';
	import DraftDock from '$lib/components/DraftDock.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import PwaInstallHint from '$lib/components/PwaInstallHint.svelte';
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
	import { flushSyncOutbox } from '$lib/storage/flushSyncOutbox';
	import { page } from '$app/stores';
	import { onNavigate } from '$app/navigation';
	import { onMount } from 'svelte';

	let { children } = $props();

	let path = $derived($page.url.pathname);
	let lang = $derived($resolvedLocale);
	let isLight = $derived($appTheme === 'light');
	let hasActiveSession = $derived(Boolean($live.ready && $live.session && !$live.session.finishedAt));
	function mobileFlowChrome(pathname: string): boolean {
		if (pathname.startsWith('/live/')) return true;
		if (pathname.startsWith('/builder')) return true;
		if (pathname.startsWith('/exercise/')) return true;
		if (pathname.startsWith('/catalog')) return true;
		if (pathname.startsWith('/articles')) return true;
		if (pathname.startsWith('/auth')) return true;
		if (pathname === '/privacy') return true;
		if (pathname === '/exercises/saved') return true;
		if (pathname === '/records') return true;
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

		const onOnline = () => {
			void flushSyncOutbox();
		};
		window.addEventListener('online', onOnline);
		if (navigator.onLine) void flushSyncOutbox();

		const syncKeyboardInset = () => {
			const root = document.documentElement;
			const vv = window.visualViewport;
			if (!vv) {
				root.style.setProperty('--vv-keyboard-inset', '0px');
				root.style.removeProperty('--vv-bottom-pad');
				return;
			}
			const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
			root.style.setProperty('--vv-keyboard-inset', `${inset}px`);
			if (inset > 48) root.style.setProperty('--vv-bottom-pad', '0px');
			else root.style.removeProperty('--vv-bottom-pad');
		};
		syncKeyboardInset();
		window.visualViewport?.addEventListener('resize', syncKeyboardInset);
		window.visualViewport?.addEventListener('scroll', syncKeyboardInset);

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
			syncKeyboardInset();
		};

		const onVisible = () => {
			if (document.visibilityState === 'visible') recoverFixedChrome();
		};
		document.addEventListener('visibilitychange', onVisible);
		window.addEventListener('pageshow', recoverFixedChrome);
		window.visualViewport?.addEventListener('resize', recoverFixedChrome);

		return () => {
			window.removeEventListener('online', onOnline);
			document.removeEventListener('visibilitychange', onVisible);
			window.removeEventListener('pageshow', recoverFixedChrome);
			window.visualViewport?.removeEventListener('resize', recoverFixedChrome);
			window.visualViewport?.removeEventListener('resize', syncKeyboardInset);
			window.visualViewport?.removeEventListener('scroll', syncKeyboardInset);
			document.documentElement.style.removeProperty('--vv-keyboard-inset');
			document.documentElement.style.removeProperty('--vv-bottom-pad');
		};
	});

	function isActive(href: string): boolean {
		if (href === '/') return path === '/';
		if (href === '/exercises') {
			return (
				path === '/exercises' ||
				path.startsWith('/exercises/') ||
				path.startsWith('/catalog/') ||
				path.startsWith('/exercise/') ||
				path.startsWith('/articles') ||
				path === '/records'
			);
		}
		if (href === '/workouts') {
			return (
				path === '/workouts' ||
				path.startsWith('/workouts/') ||
				path.startsWith('/live/')
			);
		}
		if (href === '/builder') {
			return path.startsWith('/builder');
		}
		if (href === '/auth') return path === '/auth' || path.startsWith('/auth/') || path === '/privacy';
		return path === href || path.startsWith(`${href}/`);
	}
</script>

<svelte:head>
	<link rel="icon" href="/icon-adaptive.svg" type="image/svg+xml" />
	<link rel="manifest" href="/manifest.webmanifest" />
	<meta name="apple-mobile-web-app-title" content="Repdraft" />
	<title>Repdraft</title>
</svelte:head>

<a class="skip-link" href="#main-content">{translate(lang, 'a11y.skip')}</a>
<div class="app-shell" class:app-shell--immersive={hideMobileHeader}>
	<AppSidebar {path} {isActive} {hasActiveSession} />

	<div class="shell-body flex min-h-dvh min-w-0 flex-1 flex-col">
		<header
			class="shell-header-mobile sticky top-0 z-30 border-b border-[var(--color-border)] pt-[var(--safe-top)]"
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
			class="shell-main mx-auto w-full min-w-0 flex-1"
			class:shell-main--subroute={hideMobileHeader}
			class:shell-main--flow={hideMobileHeader}
			tabindex="-1"
		>
			{#if !hideMobileHeader || path === '/'}
				<PwaInstallHint />
			{/if}
			{@render children()}
		</main>

		<div class="shell-footer-pad">
			<AttributionFooter />
		</div>
	</div>
</div>

<nav
	class="shell-nav-tabbar fixed inset-x-0 bottom-0 z-40"
	class:shell-nav-tabbar-hidden={hideMobileHeader}
	aria-label={translate(lang, 'nav.main')}
>
	<div class="shell-nav-tabbar__inner">
		<div class="shell-nav-tabbar__grid">
		<a
			class="tab-link"
			data-active={isActive('/')}
			href="/"
			aria-current={isActive('/') ? 'page' : undefined}
		>
			<span class="tab-link__inner">
				<span class="tab-link-icon">
					<LucideIcon icon={House} size={ICON_SIDEBAR} />
				</span>
				<span class="tab-link__label">{translate(lang, 'nav.tabHome')}</span>
			</span>
		</a>
		<a
			class="tab-link"
			data-active={isActive('/workouts')}
			href="/workouts"
			aria-current={isActive('/workouts') ? 'page' : undefined}
			aria-label={hasActiveSession
				? `${translate(lang, 'nav.workouts')}. ${translate(lang, 'nav.liveActive')}`
				: undefined}
		>
			<span class="tab-link__inner">
				<span class="tab-link-icon">
					<LucideIcon icon={Dumbbell} size={ICON_SIDEBAR} />
					{#if hasActiveSession}
						<span class="tab-link-live-dot" aria-hidden="true"></span>
					{/if}
				</span>
				<span class="tab-link__label">{translate(lang, 'nav.workouts')}</span>
			</span>
		</a>
		<a
			class="tab-link"
			data-active={isActive('/exercises')}
			href="/exercises"
			aria-current={isActive('/exercises') ? 'page' : undefined}
		>
			<span class="tab-link__inner">
				<span class="tab-link-icon">
					<LucideIcon icon={Library} size={ICON_SIDEBAR} />
				</span>
				<span class="tab-link__label">{translate(lang, 'nav.exercises')}</span>
			</span>
		</a>
		</div>
	</div>
</nav>

<ToastStack items={$toasts} />
<DraftDock />
