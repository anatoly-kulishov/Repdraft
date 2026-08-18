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
		if (size === 'lg') return 'logo-mark logo-mark--lg';
		if (size === 'sm') return 'logo-mark logo-mark--sm';
		return 'logo-mark logo-mark--md';
	});

	let linkClass = $derived(
		'logo-link group inline-flex min-w-0 max-w-full items-center text-[var(--color-ink)] no-underline'
	);
</script>

<a href="/" class={linkClass} aria-label={translate(lang, 'nav.home')}>
	{#if compact}
		<svg
			class="{markClass} shrink-0 transition-opacity duration-200 group-hover:opacity-90"
			viewBox="0 0 512 512"
			fill="none"
			aria-hidden="true"
		>
			<path
				d="M148 112V392M148 112H286C347 112 380 148 380 198C380 248 347 280 286 280H148M218 280L350 408"
				fill="none"
				stroke="#8B5CF6"
				stroke-width="34"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>
	{:else}
		<svg
			class="{lockupClass} shrink-0 transition-opacity duration-200 group-hover:opacity-90"
			viewBox="0 0 142 32"
			fill="none"
			role="img"
			aria-label="REPDRAFT"
		>
			<g transform="translate(0.8 1.3) scale(0.0565)">
				<path
					d="M148 112V392M148 112H286C347 112 380 148 380 198C380 248 347 280 286 280H148M218 280L350 408"
					fill="none"
					stroke="#8B5CF6"
					stroke-width="34"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</g>
			<text
				class="logo-wordmark-svg"
				x="29"
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
