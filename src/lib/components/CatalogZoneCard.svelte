<script lang="ts">
	import { withFromParam } from '$lib/domain/catalogLinks';
	import { labelCatalogZone } from '$lib/domain/catalogLinks';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	let {
		bodyPart,
		count = 0,
		coverImage = null as string | null,
		from = null as string | null,
		priority = false
	}: {
		bodyPart: string;
		count?: number;
		coverImage?: string | null;
		/** Builder return path, e.g. `/builder`. */
		from?: string | null;
		/** Hub LCP candidate: eager + high fetch priority. */
		priority?: boolean;
	} = $props();

	let lang = $derived($resolvedLocale);
	let label = $derived(labelCatalogZone(bodyPart, lang));
	let href = $derived(withFromParam(`/catalog/${encodeURIComponent(bodyPart)}`, from));
</script>

<a {href} class="zone-card zone-card--hub">
	{#if coverImage}
		<div class="zone-card__media-wrap zone-card__media-wrap--hub media-well" aria-hidden="true">
			<img
				class="zone-card__media zone-card__media--hub"
				src={`/${coverImage}`}
				alt=""
				width="180"
				height="180"
				sizes="(min-width: 1280px) 7.25rem, (min-width: 1024px) 6.75rem, 120px"
				loading={priority ? 'eager' : 'lazy'}
				fetchpriority={priority ? 'high' : 'auto'}
				decoding={priority ? 'sync' : 'async'}
			/>
		</div>
	{/if}
	<div class="zone-card__body zone-card__body--hub">
		<h2 class="zone-card__title">{label}</h2>
		{#if count > 0}
			<p class="zone-card__meta">{translate(lang, 'catalog.zoneCount', { n: count })}</p>
		{/if}
	</div>
</a>
