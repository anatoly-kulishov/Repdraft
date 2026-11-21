<script lang="ts">
	import { browser } from '$app/environment';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	const STORAGE_KEY = 'repdraft:cookie-notice:v1';

	let lang = $derived($resolvedLocale);
	let visible = $state(false);

	$effect(() => {
		if (!browser) return;
		try {
			visible = localStorage.getItem(STORAGE_KEY) !== '1';
		} catch {
			visible = false;
		}
	});

	function accept() {
		visible = false;
		try {
			localStorage.setItem(STORAGE_KEY, '1');
		} catch {
			/* private mode: hide for this session only */
		}
	}
</script>

{#if visible}
	<div class="cookie-notice" role="region" aria-label={translate(lang, 'cookie.aria')}>
		<div class="cookie-notice__panel">
			<p class="cookie-notice__title">{translate(lang, 'cookie.title')}</p>
			<p class="cookie-notice__body">
				{translate(lang, 'cookie.body')}
				<a class="cookie-notice__link" href="/privacy">{translate(lang, 'cookie.policyLink')}</a>.
			</p>
			<button type="button" class="cookie-notice__button" onclick={accept}>
				{translate(lang, 'cookie.accept')}
			</button>
		</div>
	</div>
{/if}

<style>
	.cookie-notice {
		position: fixed;
		inset-inline: 0;
		bottom: calc(var(--tabbar-chrome-h) + var(--tabbar-float-gap) + var(--safe-bottom) + 0.5rem);
		z-index: 30;
		display: flex;
		justify-content: center;
		padding: 0 0.75rem;
		pointer-events: none;
	}

	.cookie-notice__panel {
		pointer-events: auto;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		width: min(100%, 32rem);
		padding: 0.85rem 1rem;
		border-radius: 0.9rem;
		border: 1px solid var(--color-border);
		background: var(--color-panel, var(--color-surface));
		box-shadow: 0 10px 30px color-mix(in srgb, #000 18%, transparent);
	}

	.cookie-notice__title {
		margin: 0;
		font-size: 0.875rem;
		font-weight: 700;
		color: var(--color-text);
	}

	.cookie-notice__body {
		margin: 0;
		font-size: 0.8125rem;
		line-height: 1.4;
		color: var(--color-muted);
	}

	.cookie-notice__link {
		color: inherit;
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.cookie-notice__button {
		align-self: flex-end;
		min-height: 40px;
		padding: 0.45rem 1.1rem;
		border-radius: 999px;
		border: 1px solid var(--color-accent);
		background: var(--color-accent-fill, var(--color-accent));
		color: var(--color-accent-ink, #fff);
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
	}

	.cookie-notice__button:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}

	/* Immersive routes hide the tabbar: sit closer to the edge. */
	:global(.app-shell--immersive) .cookie-notice {
		bottom: calc(var(--safe-bottom) + 0.5rem);
	}

	@media (min-width: 1024px) {
		.cookie-notice {
			bottom: calc(var(--safe-bottom) + 1rem);
			inset-inline-start: 0;
			inset-inline-end: 0;
		}
	}
</style>
