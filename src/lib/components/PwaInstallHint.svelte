<script lang="ts">
	import { dismissInstallHint, isInstallHintDismissed } from '$lib/domain/prefs';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { onMount } from 'svelte';

	type BeforeInstallPromptEvent = Event & {
		prompt: () => Promise<void>;
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
	};

	let lang = $derived($resolvedLocale);
	let deferred = $state<BeforeInstallPromptEvent | null>(null);
	let visible = $state(false);

	function isStandalone(): boolean {
		if (typeof window === 'undefined') return true;
		const mq = window.matchMedia('(display-mode: standalone)').matches;
		const ios = 'standalone' in navigator && Boolean((navigator as { standalone?: boolean }).standalone);
		return mq || ios;
	}

	onMount(() => {
		if (isStandalone() || isInstallHintDismissed()) return;

		const onBip = (e: Event) => {
			e.preventDefault();
			deferred = e as BeforeInstallPromptEvent;
			visible = true;
		};
		window.addEventListener('beforeinstallprompt', onBip);
		return () => window.removeEventListener('beforeinstallprompt', onBip);
	});

	async function install() {
		if (!deferred) return;
		await deferred.prompt();
		await deferred.userChoice.catch(() => null);
		deferred = null;
		visible = false;
		dismissInstallHint();
	}

	function dismiss() {
		visible = false;
		deferred = null;
		dismissInstallHint();
	}
</script>

{#if visible && deferred}
	<div class="pwa-install panel" role="region" aria-label={translate(lang, 'pwa.installTitle')}>
		<div class="pwa-install__copy min-w-0">
			<p class="pwa-install__title">{translate(lang, 'pwa.installTitle')}</p>
			<p class="pwa-install__hint">{translate(lang, 'pwa.installHint')}</p>
		</div>
		<div class="pwa-install__actions">
			<button type="button" class="btn-primary min-h-11" onclick={() => void install()}>
				{translate(lang, 'pwa.installAction')}
			</button>
			<button type="button" class="btn-ghost min-h-11" onclick={dismiss}>
				{translate(lang, 'pwa.installDismiss')}
			</button>
		</div>
	</div>
{/if}
