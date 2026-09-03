<script lang="ts">
	import './layout.css';
	import { appTheme } from '$lib/stores/theme';
	import AppSidebar from '$lib/components/AppSidebar.svelte';
	import AttributionFooter from '$lib/components/AttributionFooter.svelte';
	import AccountChip from '$lib/components/AccountChip.svelte';
	import DraftDock from '$lib/components/DraftDock.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import NetworkStatusChip from '$lib/components/NetworkStatusChip.svelte';
	import ShellHomeGreeting from '$lib/components/ShellHomeGreeting.svelte';
	import PwaInstallHint from '$lib/components/PwaInstallHint.svelte';
	import ToastStack from '$lib/components/ToastStack.svelte';
	import ThemeToggleIcon from '$lib/components/ThemeToggleIcon.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import {
		ICON_SIDEBAR,
		ICON_TAB,
		ICON_TAB_STROKE,
		ICON_TAB_STROKE_ACTIVE
	} from '$lib/components/icons/sizes';
	import { BookOpen, ClipboardList, Dumbbell, House } from '@lucide/svelte';
	import { isBuilderReturnPath } from '$lib/domain/catalogLinks';
	import { showsExerciseMediaAttribution } from '$lib/domain/mediaAttribution';
	import { translate } from '$lib/i18n/messages';
	import { auth } from '$lib/stores/auth';
	import { draft } from '$lib/stores/draft';
	import { live } from '$lib/stores/live';
	import { techniqueClipHints } from '$lib/stores/techniqueClipHints';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';
	import { onboarding } from '$lib/stores/onboarding';
	import { flushSyncOutbox } from '$lib/storage/flushSyncOutbox';
	import { whenIdle } from '$lib/browser/idle';
	import { readSearchParam } from '$lib/navigation/urlSearchParams';
	import { page } from '$app/stores';
	import { onNavigate } from '$app/navigation';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { browser, dev } from '$app/environment';
	import { injectAnalytics } from '@vercel/analytics/sveltekit';
	import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';

	injectAnalytics({ mode: dev ? 'development' : 'production' });
	injectSpeedInsights();

	if (browser) {
		onboarding.init(new URLSearchParams(window.location.search));
	}

	let { children } = $props();

	let path = $derived($page.url.pathname);
	let fromParam = $derived(readSearchParam($page.url, 'from'));
	let lang = $derived($resolvedLocale);
	let isLight = $derived($appTheme === 'light');
	let hasActiveSession = $derived(Boolean($live.ready && $live.session && !$live.session.finishedAt));
	function mobileFlowChrome(pathname: string, from: string | null, tab: string | null): boolean {
		if (pathname.startsWith('/live/')) return true;
		if (pathname.startsWith('/builder')) return true;
		if (pathname.startsWith('/exercise/')) return true;
		if (pathname.startsWith('/catalog')) return true;
		if (pathname.startsWith('/articles')) return true;
		if (pathname.startsWith('/auth')) return true;
		if (pathname === '/privacy') return true;
		if (pathname === '/scenarios') return true;
		if (pathname.startsWith('/exercises/')) return true;
		/* Builder → pick exercise: ScreenHeader only (no logo chrome + phantom spacer). */
		if (pathname === '/exercises' && isBuilderReturnPath(from)) return true;
		if (pathname === '/workouts/summary') return true;
		if (pathname === '/workouts' && tab === 'history') return true;
		if (pathname.startsWith('/workouts/history/')) return true;
		if (/^\/workouts\/[^/]+$/.test(pathname)) return true;
		return false;
	}

	let workoutsTab = $derived(readSearchParam($page.url, 'tab'));
	let hideMobileHeader = $derived(mobileFlowChrome(path, fromParam, workoutsTab));
	let showHomeShellHeader = $derived(path === '/' && !hideMobileHeader);
	let showMediaAttribution = $derived(showsExerciseMediaAttribution(path));

	onNavigate((navigation) => {
		if (typeof document === 'undefined') return;
		/* Native swipe-back / history already animates; VT double-paints and flickers chrome. */
		if (navigation.type === 'popstate') {
			/* Kill media opacity 0→1 / zone skeleton flash on remount after gesture back. */
			document.documentElement.dataset.navBack = '1';
			void navigation.complete.finally(() => {
				requestAnimationFrame(() => {
					requestAnimationFrame(() => {
						delete document.documentElement.dataset.navBack;
					});
				});
			});
			return;
		}
		if (!document.startViewTransition) return;
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		return new Promise<void>((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});

	onMount(() => {
		onboarding.init(get(page).url.searchParams);
		draft.hydrate();
		live.hydrate();
		techniqueClipHints.hydrate();
		whenIdle(() => void techniqueClipHints.refresh());
		void auth.init();

		/* Belt-and-suspenders: same hide path as app.html (respects min splash time). */
		const hideBoot = (window as Window & { __repdraftHideBoot?: () => void }).__repdraftHideBoot;
		if (typeof hideBoot === 'function') {
			hideBoot();
		} else {
			const boot = document.getElementById('pwa-boot');
			if (boot) {
				boot.classList.add('is-done');
				window.setTimeout(() => boot.remove(), 220);
			}
		}

		const onOnline = () => {
			void flushSyncOutbox();
			void techniqueClipHints.refresh();
		};
		window.addEventListener('online', onOnline);
		if (navigator.onLine) void flushSyncOutbox();

		const syncVvChrome = (window as Window & { __repdraftSyncVvChrome?: () => void })
			.__repdraftSyncVvChrome;
		syncVvChrome?.();

		const recoverOverflow = () => {
			if (
				document.body.style.overflow === 'hidden' &&
				!document.querySelector('[aria-modal="true"]')
			) {
				document.body.style.overflow = '';
			}
		};

		const onVisible = () => {
			if (document.visibilityState === 'visible') {
				syncVvChrome?.();
				recoverOverflow();
				void flushSyncOutbox();
				void techniqueClipHints.refresh();
			}
		};
		document.addEventListener('visibilitychange', onVisible);
		window.addEventListener('pageshow', () => {
			syncVvChrome?.();
			recoverOverflow();
		});

		return () => {
			window.removeEventListener('online', onOnline);
			document.removeEventListener('visibilitychange', onVisible);
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
				path.startsWith('/articles')
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

<a class="skip-link" href="#main-content">{translate(lang, 'a11y.skip')}</a>
<div class="app-shell" class:app-shell--immersive={hideMobileHeader}>
	<AppSidebar {path} {isActive} {hasActiveSession} />

	<div class="shell-body flex min-h-dvh min-w-0 flex-1 flex-col">
		<header
			class="shell-header-mobile sticky top-0 z-30 border-b border-[var(--color-border)] pt-[var(--safe-top)]"
			class:shell-header-mobile-hidden={hideMobileHeader}
			class:shell-header-mobile--home={showHomeShellHeader}
		>
			<div class="shell-header-mobile__bar flex h-14 w-full items-center justify-between gap-3 shell-header-pad">
				{#if showHomeShellHeader}
					<ShellHomeGreeting />
				{:else}
					<Logo compact />
				{/if}
				<div class="shell-header-actions flex items-center">
					<button
						type="button"
						class="shell-theme-toggle"
						onclick={() => appTheme.toggle()}
						aria-label={translate(
							lang,
							!$auth.ready
								? 'common.loading'
								: isLight
									? 'settings.themeDark'
									: 'settings.themeLight'
						)}
						title={translate(
							lang,
							!$auth.ready
								? 'common.loading'
								: isLight
									? 'settings.themeDark'
									: 'settings.themeLight'
						)}
					>
						{#if !$auth.ready}
							<span class="shell-theme-toggle__skeleton" aria-hidden="true"></span>
						{:else}
							<ThemeToggleIcon isLight={isLight} size={ICON_SIDEBAR} strokeWidth={1.75} />
						{/if}
					</button>
					{#if !showHomeShellHeader}
						<AccountChip active={isActive('/auth')} />
					{/if}
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
			{@render children()}
			{#if path === '/' || !hideMobileHeader}
				<!-- Footer slot: after page content, above tab bar. -->
				<PwaInstallHint />
			{/if}
		</main>

		{#if showMediaAttribution}
			<div class="shell-footer-pad">
				<AttributionFooter />
			</div>
		{/if}
	</div>
</div>

<nav
	class="shell-nav-tabbar fixed inset-x-0 z-40"
	class:shell-nav-tabbar-hidden={hideMobileHeader}
	aria-label={translate(lang, 'nav.main')}
>
	<NetworkStatusChip />
	<div class="shell-nav-tabbar__inner">
		<div class="shell-nav-tabbar__grid">
		<a
			href="/"
			class="tab-link"
			data-active={isActive('/')}
			aria-current={isActive('/') ? 'page' : undefined}
		>
			<span class="tab-link__inner">
				<span class="tab-link-icon">
					<LucideIcon
						icon={House}
						size={ICON_TAB}
						strokeWidth={isActive('/') ? ICON_TAB_STROKE_ACTIVE : ICON_TAB_STROKE}
					/>
				</span>
				<span class="tab-link__label">{translate(lang, 'nav.tabHome')}</span>
			</span>
		</a>
		<a
			href="/workouts"
			class="tab-link"
			data-active={isActive('/workouts')}
			aria-current={isActive('/workouts') ? 'page' : undefined}
			aria-label={hasActiveSession
				? `${translate(lang, 'nav.workouts')}. ${translate(lang, 'nav.liveActive')}`
				: undefined}
		>
			<span class="tab-link__inner">
				<span class="tab-link-icon">
					<LucideIcon
						icon={Dumbbell}
						size={ICON_TAB}
						strokeWidth={isActive('/workouts') ? ICON_TAB_STROKE_ACTIVE : ICON_TAB_STROKE}
					/>
				</span>
				<span class="tab-link__label">{translate(lang, 'nav.workouts')}</span>
			</span>
		</a>
		<a
			href="/exercises"
			class="tab-link"
			data-active={isActive('/exercises')}
			aria-current={isActive('/exercises') ? 'page' : undefined}
		>
			<span class="tab-link__inner">
				<span class="tab-link-icon">
					<LucideIcon
						icon={BookOpen}
						size={ICON_TAB}
						strokeWidth={isActive('/exercises') ? ICON_TAB_STROKE_ACTIVE : ICON_TAB_STROKE}
					/>
				</span>
				<span class="tab-link__label">{translate(lang, 'nav.exercises')}</span>
			</span>
		</a>
		</div>
	</div>
</nav>

<ToastStack items={$toasts} />
<DraftDock />
