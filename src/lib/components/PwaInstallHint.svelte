<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_BUTTON, ICON_SMALL } from '$lib/components/icons/sizes';
	import {
		isDesktopChromiumInstallSurface,
		isInstalledDisplayMode,
		resolvePwaManualGuide,
		type PwaManualGuide
	} from '$lib/domain/pwaInstall';
	import {
		clearPwaInstalledPref,
		dismissInstallHint,
		isInstallHintDismissed,
		isPwaInstalledPref,
		markPwaInstalled
	} from '$lib/domain/prefs';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { onboarding } from '$lib/stores/onboarding';
	import {
		ChevronDown,
		ChevronRight,
		Download,
		Ellipsis,
		HousePlus,
		Share,
		X
	} from '@lucide/svelte';
	import { onMount } from 'svelte';
	import type { Component } from 'svelte';

	type BeforeInstallPromptEvent = Event & {
		prompt: () => Promise<void>;
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
	};

	type InstallMode = 'prompt' | 'desktop' | PwaManualGuide;

	type BipHost = Window & {
		__repdraftBip?: BeforeInstallPromptEvent | null;
		chrome?: unknown;
	};

	let lang = $derived($resolvedLocale);
	let deferred = $state<BeforeInstallPromptEvent | null>(null);
	let mode = $state<InstallMode | null>(null);
	let visible = $derived(mode !== null);
	let canInstall = $derived(deferred !== null);

	function isRunningInstalled(): boolean {
		if (typeof window === 'undefined') return true;
		const iosStandalone =
			'standalone' in navigator && Boolean((navigator as { standalone?: boolean }).standalone);
		return isInstalledDisplayMode((q) => window.matchMedia(q).matches, iosStandalone);
	}

	function chromiumRuntime(): boolean {
		return Boolean((window as BipHost).chrome);
	}

	function readManualGuide(): PwaManualGuide | null {
		return resolvePwaManualGuide({
			ua: navigator.userAgent,
			platform: navigator.platform,
			maxTouchPoints: navigator.maxTouchPoints,
			coarsePointer: window.matchMedia('(pointer: coarse)').matches,
			hasChromiumRuntime: chromiumRuntime()
		});
	}

	function readDesktopSurface(): boolean {
		return isDesktopChromiumInstallSurface({
			hasChromiumRuntime: chromiumRuntime(),
			finePointerHover: window.matchMedia('(hover: hover) and (pointer: fine)').matches,
			ua: navigator.userAgent
		});
	}

	function takeCapturedBip(): BeforeInstallPromptEvent | null {
		const host = window as BipHost;
		const ev = host.__repdraftBip ?? null;
		if (ev) host.__repdraftBip = null;
		return ev;
	}

	function applyBip(ev: BeforeInstallPromptEvent) {
		if (onboarding.deferPwaHint()) return;
		deferred = ev;
		mode = 'prompt';
	}

	const safariSteps: { icon: Component; labelKey: 'pwa.iosStep1' | 'pwa.iosStep2' | 'pwa.iosStep3' }[] =
		[
			{ icon: Share, labelKey: 'pwa.iosStep1' },
			{ icon: ChevronDown, labelKey: 'pwa.iosStep2' },
			{ icon: HousePlus, labelKey: 'pwa.iosStep3' }
		];

	const chromeSteps: {
		icon: Component;
		labelKey: 'pwa.chromeStep1' | 'pwa.chromeStep2' | 'pwa.chromeStep3';
	}[] = [
		{ icon: Ellipsis, labelKey: 'pwa.chromeStep1' },
		{ icon: ChevronDown, labelKey: 'pwa.chromeStep2' },
		{ icon: HousePlus, labelKey: 'pwa.chromeStep3' }
	];

	const desktopSteps: {
		icon: Component;
		labelKey: 'pwa.desktopStep1' | 'pwa.desktopStep2' | 'pwa.desktopStep3';
	}[] = [
		{ icon: Ellipsis, labelKey: 'pwa.desktopStep1' },
		{ icon: Download, labelKey: 'pwa.desktopStep2' },
		{ icon: HousePlus, labelKey: 'pwa.desktopStep3' }
	];

	function hideInstalled() {
		markPwaInstalled();
		deferred = null;
		mode = null;
	}

	onMount(() => {
		if (isRunningInstalled()) {
			markPwaInstalled();
			return;
		}
		if (isInstallHintDismissed()) return;

		const early = takeCapturedBip();
		if (early) applyBip(early);

		const onBip = (e: Event) => {
			e.preventDefault();
			applyBip(e as BeforeInstallPromptEvent);
		};
		const onCaptured = () => {
			const ev = takeCapturedBip();
			if (ev) applyBip(ev);
		};
		const onInstalled = () => {
			hideInstalled();
			dismissInstallHint();
		};
		window.addEventListener('beforeinstallprompt', onBip);
		window.addEventListener('repdraft:bip', onCaptured);
		window.addEventListener('appinstalled', onInstalled);

		let revealTimer: ReturnType<typeof setTimeout> | undefined;
		let cancelled = false;

		void (async () => {
			const nav = navigator as Navigator & {
				getInstalledRelatedApps?: () => Promise<Array<{ platform: string }>>;
			};
			try {
				const related = await nav.getInstalledRelatedApps?.();
				if (cancelled) return;
				if (related) {
					if (related.some((app) => app.platform === 'webapp')) {
						hideInstalled();
						return;
					}
					// API available and empty → app not installed; drop stale flag.
					if (isPwaInstalledPref()) clearPwaInstalledPref();
				} else if (isPwaInstalledPref()) {
					return;
				}
			} catch {
				if (isPwaInstalledPref()) return;
			}
			if (cancelled || deferred || isInstallHintDismissed() || isPwaInstalledPref()) return;

			const manual = readManualGuide();
			const desktop = !manual && readDesktopSurface();
			if (!manual && !desktop) return;

			revealTimer = setTimeout(() => {
				if (cancelled || deferred || isPwaInstalledPref() || isInstallHintDismissed()) return;
				if (onboarding.deferPwaHint()) return;
				mode = manual ?? 'desktop';
			}, 500);
		})();

		return () => {
			cancelled = true;
			window.removeEventListener('beforeinstallprompt', onBip);
			window.removeEventListener('repdraft:bip', onCaptured);
			window.removeEventListener('appinstalled', onInstalled);
			if (revealTimer) clearTimeout(revealTimer);
		};
	});

	async function install() {
		if (!deferred) return;
		await deferred.prompt();
		const choice = await deferred.userChoice.catch(() => null);
		deferred = null;
		mode = null;
		if (choice?.outcome === 'accepted') {
			markPwaInstalled();
		}
		dismissInstallHint();
	}

	function dismiss() {
		mode = null;
		deferred = null;
		dismissInstallHint();
	}

	let steps = $derived(
		mode === 'ios-chrome' ? chromeSteps : mode === 'desktop' ? desktopSteps : safariSteps
	);
	let stepsAria = $derived(
		translate(
			lang,
			mode === 'ios-chrome'
				? 'pwa.installHintChrome'
				: mode === 'desktop'
					? 'pwa.installHintDesktop'
					: 'pwa.installHintIos'
		)
	);
	let hintKey = $derived(
		mode === 'desktop' || mode === 'prompt' ? 'pwa.installHintDesktop' : 'pwa.installHint'
	);
</script>

{#if visible && mode}
	{@const showGuide = mode === 'ios-safari' || mode === 'ios-chrome' || (mode === 'desktop' && !canInstall)}
	{@const showInstall = mode === 'prompt' || (mode === 'desktop' && canInstall)}
	<div
		class="pwa-install"
		class:pwa-install--prompt={showInstall}
		class:pwa-install--guide={showGuide}
		role="region"
		aria-label={translate(lang, 'pwa.installTitle')}
	>
		<div class="pwa-install__bar">
			<span class="pwa-install__icon" aria-hidden="true">
				<LucideIcon icon={showInstall ? Download : HousePlus} size={ICON_SMALL} />
			</span>
			<div class="pwa-install__copy min-w-0">
				<p class="pwa-install__title">{translate(lang, 'pwa.installTitle')}</p>
				<p class="pwa-install__hint">{translate(lang, hintKey)}</p>
			</div>
			{#if showInstall}
				<AppButton
					variant="primary"
					class="pwa-install__cta"
					onclick={() => void install()}
					aria-label={translate(lang, 'pwa.installAction')}
					title={translate(lang, 'pwa.installAction')}
				>
					<LucideIcon icon={Download} size={ICON_BUTTON} />
				</AppButton>
			{/if}
			<AppButton
				variant="ghost"
				class="pwa-install__close"
				onclick={dismiss}
				aria-label={translate(lang, 'pwa.installDismiss')}
			>
				<LucideIcon icon={X} size={ICON_SMALL} />
			</AppButton>
		</div>

		{#if showGuide}
			{#if mode === 'desktop'}
				<p class="pwa-install__fallback">{translate(lang, 'pwa.installHintDesktopMenu')}</p>
			{/if}
			<ol class="pwa-install__steps" aria-label={stepsAria}>
				{#each steps as step, i (step.labelKey)}
					{#if i > 0}
						<li class="pwa-install__step-sep" aria-hidden="true">
							<LucideIcon icon={ChevronRight} size={ICON_SMALL} />
						</li>
					{/if}
					<li class="pwa-install__step">
						<span class="pwa-install__step-icon" aria-hidden="true">
							<LucideIcon icon={step.icon} size={ICON_SMALL} />
						</span>
						<span class="pwa-install__step-label">{translate(lang, step.labelKey)}</span>
					</li>
				{/each}
			</ol>
		{/if}
	</div>
{/if}
