<script lang="ts">
	import { labelBodyPart } from '$lib/domain/labels.ru';
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
	let label = $derived(labelBodyPart(bodyPart, lang));
	let href = $derived(`/catalog/${encodeURIComponent(bodyPart)}`);
</script>

<a {href} class="zone-card">
	<div class="zone-card__body">
		<h2 class="zone-card__title">{label}</h2>
		{#if count > 0}
			<p class="zone-card__meta">{translate(lang, 'catalog.zoneCount', { n: count })}</p>
		{/if}
	</div>
	{#if coverImage}
		<div class="zone-card__media-wrap" aria-hidden="true">
			<img
				class="zone-card__media"
				src={`/${coverImage}`}
				alt=""
				width="180"
				height="180"
				loading="lazy"
				decoding="async"
			/>
		</div>
	{/if}
</a>
