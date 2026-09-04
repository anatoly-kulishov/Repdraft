<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_FAB, ICON_FAB_STROKE } from '$lib/components/icons/sizes';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { cn } from '$lib/utils.js';
	import { ArrowUp } from '@lucide/svelte';
	import { browser } from '$app/environment';

	/** Show after roughly one short phone screen of scroll. */
	const DEFAULT_AFTER_PX = 360;

	let {
		afterPx = DEFAULT_AFTER_PX,
		class: className = ''
	}: {
		afterPx?: number;
		class?: string;
	} = $props();

	let lang = $derived($resolvedLocale);
	let visible = $state(false);

	function scrollToTop() {
		const main = document.getElementById('main-content');
		if (main) {
			main.scrollIntoView({ behavior: 'smooth', block: 'start' });
			return;
		}
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	$effect(() => {
		if (!browser) {
			visible = false;
			return;
		}
		const onScroll = () => {
			const y = window.scrollY || document.documentElement.scrollTop || 0;
			visible = y >= afterPx;
		};
		onScroll();
		window.addEventListener('scroll', onScroll, { passive: true });
		return () => window.removeEventListener('scroll', onScroll);
	});
</script>

<AppButton
	variant="secondary"
	class={cn('scroll-to-top-fab lg:hidden', visible && 'is-visible', className)}
	aria-hidden={!visible}
	tabindex={visible ? 0 : -1}
	aria-label={translate(lang, 'workouts.scrollToTop')}
	title={translate(lang, 'workouts.scrollToTop')}
	onclick={scrollToTop}
>
	<LucideIcon icon={ArrowUp} size={ICON_FAB} strokeWidth={ICON_FAB_STROKE} />
</AppButton>
