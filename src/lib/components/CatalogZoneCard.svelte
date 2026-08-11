<script lang="ts">
	import { labelCatalogZone } from '$lib/domain/catalogLinks';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	let {
		bodyPart,
		count = 0,
		coverImage = null as string | null
	}: {
		bodyPart: string;
		count?: number;
		coverImage?: string | null;
	} = $props();

	let lang = $derived($resolvedLocale);
	let label = $derived(labelCatalogZone(bodyPart, lang));
	let href = $derived(`/catalog/${encodeURIComponent(bodyPart)}`);
</script>

<a {href} class="zone-card">
	{#if coverImage}
		<div class="zone-card__media-wrap" aria-hidden="true">
			<img
				class="zone-card__media"
				src={`/${coverImage}`}
				alt=""
				width="180"
				height="180"
				sizes="(max-width: 767px) 100px, (min-width: 1280px) 116px, 108px"
				loading="lazy"
				decoding="async"
			/>
		</div>
	{/if}
	<div class="zone-card__body">
		<h2 class="zone-card__title">{label}</h2>
		{#if count > 0}
			<p class="zone-card__meta">{translate(lang, 'catalog.zoneCount', { n: count })}</p>
		{/if}
	</div>
</a>
