<script lang="ts">
	import { Star } from 'phosphor-svelte';
	import { onMount } from 'svelte';
	import AppPanel from '$lib/components/AppPanel.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import {
		SESSION_RATING_VALUES,
		ratingFor,
		type SessionRating
	} from '$lib/domain/sessionRating';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { sessionRatings } from '$lib/stores/sessionRatings';

	let { sessionId }: { sessionId: string } = $props();

	let lang = $derived($resolvedLocale);
	let mine = $derived<SessionRating | null>(ratingFor($sessionRatings, sessionId));

	onMount(() => sessionRatings.hydrate());

	function rate(stars: SessionRating) {
		sessionRatings.rate(sessionId, stars);
	}
</script>

<AppPanel>
	<div class="session-rating">
		<p class="session-rating__title">
			{mine ? translate(lang, 'rating.thanks') : translate(lang, 'rating.title')}
		</p>

		<div class="session-rating__stars" role="group" aria-label={translate(lang, 'rating.aria')}>
			{#each SESSION_RATING_VALUES as value (value)}
				<button
					type="button"
					class="session-rating__star"
					class:is-active={mine !== null && value <= mine}
					aria-pressed={mine === value}
					aria-label={translate(lang, 'rating.ariaStar', { n: value })}
					onclick={() => rate(value)}
				>
					<LucideIcon
						icon={Star}
						size={26}
						weight={mine !== null && value <= mine ? 'fill' : 'regular'}
					/>
				</button>
			{/each}
		</div>

		<p class="session-rating__hint">{translate(lang, 'rating.hint')}</p>
	</div>
</AppPanel>

<style>
	.session-rating {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 8px;
		/* `.panel` already supplies the 1rem inset. */
	}

	.session-rating__title {
		margin: 0;
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-ink);
	}

	.session-rating__stars {
		display: flex;
		gap: 2px;
	}

	.session-rating__star {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		/* 44px tap target with a 26px glyph — thumb-safe without visual bulk. */
		width: 44px;
		height: 44px;
		padding: 0;
		border: 0;
		border-radius: var(--radius-button, 12px);
		background: transparent;
		color: var(--color-muted-soft);
		cursor: pointer;
		transition:
			color 140ms ease,
			transform 140ms ease;
	}

	.session-rating__star:active {
		transform: scale(0.94);
	}

	.session-rating__star.is-active {
		color: var(--color-accent-text);
	}

	.session-rating__star:focus-visible {
		outline: none;
		box-shadow: var(--focus-ring);
	}

	.session-rating__hint {
		margin: 0;
		font-size: 0.75rem;
		line-height: 1.4;
		color: var(--color-muted);
	}
</style>
