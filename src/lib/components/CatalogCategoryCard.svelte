<script lang="ts">
	import AppSkeleton from '$lib/components/AppSkeleton.svelte';
	import { hasFadedInMedia, markFadedInMedia } from '$lib/media/mediaFadeCache';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	let {
		label,
		href,
		count = 0,
		coverImage = null as string | null,
		priority = false
	}: {
		label: string;
		href: string;
		count?: number;
		coverImage?: string | null;
		priority?: boolean;
	} = $props();

	let lang = $derived($resolvedLocale);
	let imageSrc = $derived(coverImage ? `/${coverImage}` : '');
	let loaded = $state(false);
	let imgEl = $state<HTMLImageElement | null>(null);
	let countLabel = $derived(
		count > 0 ? translate(lang, 'catalog.zoneCountShort', { n: count }) : ''
	);
	let imgLoading = $derived(
		priority || (imageSrc !== '' && hasFadedInMedia(imageSrc))
			? ('eager' as const)
			: ('lazy' as const)
	);

	$effect.pre(() => {
		loaded = coverImage ? hasFadedInMedia(`/${coverImage}`) : false;
	});

	$effect(() => {
		const img = imgEl;
		if (!coverImage) return;
		const src = `/${coverImage}`;
		if (hasFadedInMedia(src)) {
			loaded = true;
			return;
		}
		if (img?.complete && img.naturalWidth > 0) {
			markFadedInMedia(src);
			loaded = true;
		}
	});

	function onImgLoad() {
		if (coverImage) markFadedInMedia(`/${coverImage}`);
		loaded = true;
	}
</script>

<a
	{href}
	class="zone-card zone-card--grid"
	aria-label={countLabel ? `${label}, ${countLabel}` : label}
>
	<div class="zone-card__media zone-card__media--grid media-well relative min-w-0 overflow-hidden">
		{#if coverImage && !loaded}
			<AppSkeleton class="zone-card__media-skel absolute inset-0 rounded-none" aria-hidden="true" />
		{/if}
		{#if coverImage}
			<img
				bind:this={imgEl}
				class={`zone-card__img block h-full w-full ${loaded ? 'is-loaded' : ''}`}
				src={`/${coverImage}`}
				alt=""
				width="180"
				height="180"
				sizes="(min-width: 1024px) 180px, (min-width: 768px) 25vw, 45vw"
				loading={imgLoading}
				fetchpriority={priority ? 'high' : 'auto'}
				decoding="async"
				onload={onImgLoad}
			/>
		{/if}
		<div class="zone-card__scrim" aria-hidden="true"></div>
		<div class="zone-card__caption">
			<h2 class="zone-card__grid-title line-clamp-2">{label}</h2>
			{#if countLabel}
				<p class="zone-card__grid-count truncate">{countLabel}</p>
			{/if}
		</div>
	</div>
</a>
