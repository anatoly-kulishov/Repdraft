<script lang="ts">
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	let {
		size = 'md',
		compact = false,
		variant = 'default'
	}: {
		size?: 'sm' | 'md' | 'lg';
		compact?: boolean;
		variant?: 'default' | 'sidebar';
	} = $props();

	let lang = $derived($resolvedLocale);

	let lockupClass = $derived.by(() => {
		if (variant === 'sidebar') return 'logo-lockup logo-lockup--sidebar';
		if (size === 'lg') return 'logo-lockup logo-lockup--lg';
		if (size === 'sm') return 'logo-lockup logo-lockup--sm';
		return 'logo-lockup logo-lockup--md';
	});

	let markClass = $derived.by(() => {
		if (variant === 'sidebar') return 'logo-mark logo-mark--sidebar';
		return size === 'lg'
			? 'logo-mark logo-mark--lg'
			: size === 'sm'
				? 'logo-mark logo-mark--sm'
				: 'logo-mark logo-mark--md';
	});

	let linkClass = $derived(
		'logo-link group inline-flex min-w-0 max-w-full items-center text-[var(--color-ink)] no-underline'
	);
</script>

<a href="/" class={linkClass} aria-label={translate(lang, 'nav.home')}>
	{#if compact}
		<svg
			class="{markClass} shrink-0 transition-opacity duration-200 group-hover:opacity-90"
			viewBox="0 0 32 32"
			fill="none"
			aria-hidden="true"
		>
			<path d="M9 12.5V26" stroke="#8B5CF6" stroke-width="2.65" stroke-linecap="round" />
			<path d="M9 6.75V10.25" stroke="#8B5CF6" stroke-width="2.65" stroke-linecap="round" />
			<path
				d="M9 7h11.25a5.35 5.35 0 0 1 0 10.7H9"
				stroke="#8B5CF6"
				stroke-width="2.65"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
			<path d="M13.35 17.85 20.85 25.5" stroke="#8B5CF6" stroke-width="2.65" stroke-linecap="round" />
			<path d="M11.25 13.35h7.1" stroke="#8B5CF6" stroke-width="2.65" stroke-linecap="round" />
		</svg>
	{:else}
		<svg
			class="{lockupClass} shrink-0 transition-opacity duration-200 group-hover:opacity-90"
			viewBox="0 0 142 32"
			fill="none"
			role="img"
			aria-label="REPDRAFT"
		>
			<path d="M9 12.5V26" stroke="#8B5CF6" stroke-width="2.65" stroke-linecap="round" />
			<path d="M9 6.75V10.25" stroke="#8B5CF6" stroke-width="2.65" stroke-linecap="round" />
			<path
				d="M9 7h11.25a5.35 5.35 0 0 1 0 10.7H9"
				stroke="#8B5CF6"
				stroke-width="2.65"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
			<path d="M13.35 17.85 20.85 25.5" stroke="#8B5CF6" stroke-width="2.65" stroke-linecap="round" />
			<path d="M11.25 13.35h7.1" stroke="#8B5CF6" stroke-width="2.65" stroke-linecap="round" />
			<text
				class="logo-wordmark-svg"
				x="33"
				y="22.5"
				font-family="Inter, system-ui, sans-serif"
				font-size="16.5"
				font-weight="650"
				letter-spacing="0.08em"
			>
				EPDRAFT
			</text>
		</svg>
	{/if}
</a>

<style>
	.logo-wordmark-svg {
		fill: currentColor;
	}

	.logo-mark {
		display: block;
		width: auto;
		height: 2rem;
	}

	.logo-mark--sidebar {
		height: 1.625rem;
	}

	.logo-mark--sm {
		height: 1.75rem;
	}

	.logo-mark--md {
		height: 2rem;
	}

	.logo-mark--lg {
		height: 2.35rem;
	}
</style>
