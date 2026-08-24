<script lang="ts">
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { List } from '@lucide/svelte';

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
		/** Hub LCP candidate: eager + high fetch priority. */
		priority?: boolean;
	} = $props();

	let lang = $derived($resolvedLocale);
	let loaded = $state(false);
	let imgEl = $state<HTMLImageElement | null>(null);

	$effect(() => {
		const img = imgEl;
		if (img?.complete && img.naturalWidth > 0) loaded = true;
	});

	function onImgLoad() {
		loaded = true;
	}
</script>

<a {href} class="zone-card zone-card--grid">
	<div class="zone-card__media zone-card__media--grid media-well relative aspect-square min-w-0 overflow-hidden">
		{#if coverImage}
			<img
				bind:this={imgEl}
				class={`zone-card__img block h-full w-full object-contain ${loaded ? 'is-loaded' : ''}`}
				src={`/${coverImage}`}
				alt=""
				width="180"
				height="180"
				sizes="(min-width: 1024px) 180px, (min-width: 768px) 33vw, 45vw"
				loading={priority ? 'eager' : 'lazy'}
				fetchpriority={priority ? 'high' : 'auto'}
				decoding="async"
				onload={onImgLoad}
			/>
		{/if}
	</div>

	<div class="zone-card__body zone-card__body--grid flex min-w-0 flex-1 flex-col gap-1">
		<h2 class="zone-card__grid-title line-clamp-2">{label}</h2>
		{#if count > 0}
			<div class="zone-card__grid-meta">
				<span class="zone-card__grid-meta-item" title={translate(lang, 'catalog.zoneCount', { n: count })}>
					<LucideIcon icon={List} size={12} class="zone-card__grid-meta-icon" />
					<span class="truncate">{translate(lang, 'catalog.zoneCount', { n: count })}</span>
				</span>
			</div>
		{/if}
	</div>
</a>
