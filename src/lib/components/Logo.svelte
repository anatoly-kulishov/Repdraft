<script lang="ts">
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import markUrl from '$lib/assets/brand/app-icon-master.svg?url';

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
</script>

<a
	href="/"
	class="logo-link group inline-flex min-h-[48px] min-w-[48px] items-center text-[var(--color-ink)] no-underline"
	aria-label={translate(lang, 'nav.home')}
>
	<img
		class="{markClass} shrink-0 transition-opacity duration-200 group-hover:opacity-90"
		src={markUrl}
		alt=""
		width="40"
		height="40"
		decoding="async"
	/>
</a>

<style>
	/*
	  Mark SVG is crop-tight to the RP glyph. Heights map ~1:1 to visual size.
	  Mobile header is h-14; sidebar brand can take a bit more presence.
	*/
	.logo-mark {
		display: block;
		width: auto;
		height: 2.5rem;
		border-radius: 0.65rem;
	}

	.logo-mark--sidebar {
		height: 2.75rem;
	}

	.logo-mark--sm {
		height: 2.25rem;
	}

	.logo-mark--md {
		height: 2.5rem;
	}

	.logo-mark--lg {
		height: 2.75rem;
	}
</style>
