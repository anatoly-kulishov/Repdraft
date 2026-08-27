<script lang="ts">
	import BrandMark from '$lib/components/BrandMark.svelte';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	let {
		size = 'md',
		variant = 'default'
	}: {
		size?: 'sm' | 'md' | 'lg';
		variant?: 'default' | 'sidebar';
		/** @deprecated Mark-only chrome; ignored. */
		compact?: boolean;
	} = $props();

	let lang = $derived($resolvedLocale);

	let markClass = $derived.by(() => {
		if (variant === 'sidebar') return 'logo-mark logo-mark--sidebar';
		if (size === 'lg') return 'logo-mark logo-mark--lg';
		if (size === 'sm') return 'logo-mark logo-mark--sm';
		return 'logo-mark logo-mark--md';
	});

	let px = $derived.by(() => {
		if (variant === 'sidebar' || size === 'lg') return 44;
		if (size === 'sm') return 36;
		return 40;
	});
</script>

<a
	href="/"
	class="logo-link group inline-flex min-h-[48px] min-w-[48px] items-center text-[var(--color-ink)] no-underline"
	aria-label={translate(lang, 'nav.home')}
>
	<BrandMark class="{markClass} shrink-0" size={px} intensity="calm" />
</a>
