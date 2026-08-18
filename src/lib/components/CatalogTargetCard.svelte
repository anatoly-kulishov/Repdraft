<script lang="ts">
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	let {
		label,
		href,
		count = 0,
		coverImage = null as string | null
	}: {
		label: string;
		href: string;
		count?: number;
		coverImage?: string | null;
	} = $props();

	let lang = $derived($resolvedLocale);
</script>

<a {href} class="zone-card zone-card--target">
	{#if coverImage}
		<div class="zone-card__media-wrap zone-card__media-wrap--target media-well" aria-hidden="true">
			<img
				class="zone-card__media zone-card__media--target"
				src={`/${coverImage}`}
				alt=""
				width="180"
				height="180"
				sizes="(min-width: 1280px) 7.25rem, (min-width: 1024px) 6.75rem, 120px"
				loading="lazy"
				decoding="async"
			/>
		</div>
	{/if}
	<div class="zone-card__body zone-card__body--target">
		<h2 class="zone-card__title">{label}</h2>
		{#if count > 0}
			<p class="zone-card__meta">{translate(lang, 'catalog.zoneCount', { n: count })}</p>
		{/if}
	</div>
</a>
