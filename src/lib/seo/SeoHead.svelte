<script lang="ts">
	import { page } from '$app/stores';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { resolveSeoLang } from '$lib/seo/seoLang';
	import {
		absoluteUrl,
		defaultOgImage,
		formatSeoTitle,
		resolveSiteOrigin,
		SITE_NAME
	} from '$lib/seo/site';

	interface Props {
		title?: string;
		titleKey?: string;
		description?: string;
		descriptionKey?: string;
		vars?: Record<string, string | number>;
		/** Canonical pathname, e.g. `/exercises`. Query strings are ignored. */
		path?: string;
		noindex?: boolean;
		ogType?: 'website' | 'article';
		/** Site-relative (`/icon.png`) or absolute URL. */
		image?: string;
		imageWidth?: number;
		imageHeight?: number;
		imageAlt?: string;
	}

	let {
		title,
		titleKey,
		description = '',
		descriptionKey,
		vars,
		path,
		noindex = false,
		ogType = 'website',
		image,
		imageWidth = 512,
		imageHeight = 512,
		imageAlt
	}: Props = $props();

	let seoLang = $derived(resolveSeoLang($page.data.seoLocale, $resolvedLocale));
	let resolvedTitle = $derived(
		title ?? (titleKey ? translate(seoLang, titleKey, vars) : SITE_NAME)
	);
	let resolvedDescription = $derived(
		description.trim() || (descriptionKey ? translate(seoLang, descriptionKey, vars) : '')
	);
	let canonicalPath = $derived(path ?? $page.url.pathname);
	let origin = $derived(resolveSiteOrigin($page.url.origin));
	let canonicalUrl = $derived(absoluteUrl(canonicalPath, origin));
	let fullTitle = $derived(formatSeoTitle(resolvedTitle));
	let ogImage = $derived.by(() => {
		if (!image) return defaultOgImage(origin);
		return image.startsWith('http') ? image : absoluteUrl(image, origin);
	});
	let twitterCard = $derived(image && imageWidth >= 600 ? 'summary_large_image' : 'summary');
	let resolvedImageAlt = $derived(imageAlt?.trim() || resolvedTitle);
	let ogLocale = $derived(seoLang === 'ru' ? 'ru_RU' : 'en_US');
	let ogLocaleAlt = $derived(seoLang === 'ru' ? 'en_US' : 'ru_RU');
</script>

<svelte:head>
	<title>{fullTitle}</title>
	{#if resolvedDescription}
		<meta name="description" content={resolvedDescription} />
	{/if}
	{#if noindex}
		<meta name="robots" content="noindex, nofollow" />
	{/if}
	{#if origin}
		<link rel="canonical" href={canonicalUrl} />
		<meta property="og:site_name" content={SITE_NAME} />
		<meta property="og:locale" content={ogLocale} />
		<meta property="og:locale:alternate" content={ogLocaleAlt} />
		<meta property="og:type" content={ogType} />
		<meta property="og:url" content={canonicalUrl} />
		<meta property="og:title" content={fullTitle} />
		{#if resolvedDescription}
			<meta property="og:description" content={resolvedDescription} />
		{/if}
		<meta property="og:image" content={ogImage} />
		<meta property="og:image:width" content={String(imageWidth)} />
		<meta property="og:image:height" content={String(imageHeight)} />
		<meta property="og:image:alt" content={resolvedImageAlt} />
		<meta name="twitter:card" content={twitterCard} />
		<meta name="twitter:title" content={fullTitle} />
		{#if resolvedDescription}
			<meta name="twitter:description" content={resolvedDescription} />
		{/if}
		<meta name="twitter:image" content={ogImage} />
	{/if}
</svelte:head>
