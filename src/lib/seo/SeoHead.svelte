<script lang="ts">
	import { page } from '$app/stores';
	import type { AppLocale } from '$lib/i18n/locale';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { resolveSeoLang } from '$lib/seo/seoLang';
	import { isEnglishPath } from '$lib/seo/alternates';
	import {
		absoluteUrl,
		defaultOgImage,
		formatSeoTitle,
		resolveSiteOrigin,
		SITE_NAME,
		squareOgImage
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
		/** `hreflang` cluster for public pages that exist in ru and en. */
		alternates?: { lang: string; path: string }[];
		/** Force page language (English mirrors under `/en/*`). */
		locale?: AppLocale;
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
		imageWidth = 1200,
		imageHeight = 630,
		imageAlt,
		alternates = [],
		locale
	}: Props = $props();

	let canonicalPath = $derived(path ?? $page.url.pathname);
	/**
	 * A page with an `hreflang` pair declares its language by URL, not by
	 * `Accept-Language`: otherwise an English browser gets `og:locale=en_US` on the
	 * Russian canonical page that `hreflang` says is `ru`.
	 */
	let pairLang = $derived<AppLocale | null>(
		alternates.length > 0 ? (isEnglishPath(canonicalPath) ? 'en' : 'ru') : null
	);
	let seoLang = $derived(pairLang ?? locale ?? resolveSeoLang($page.data.seoLocale, $resolvedLocale));
	let resolvedTitle = $derived(
		title ?? (titleKey ? translate(seoLang, titleKey, vars) : SITE_NAME)
	);
	let resolvedDescription = $derived(
		description.trim() || (descriptionKey ? translate(seoLang, descriptionKey, vars) : '')
	);
	let origin = $derived(resolveSiteOrigin($page.url.origin));
	let canonicalUrl = $derived(absoluteUrl(canonicalPath, origin));
	let fullTitle = $derived(formatSeoTitle(resolvedTitle));
	let ogImage = $derived.by(() => {
		if (!image) return defaultOgImage(origin);
		return image.startsWith('http') ? image : absoluteUrl(image, origin);
	});
	/** Default pages only. A custom share image (articles) stays the only og:image. */
	let searchThumb = $derived(image ? '' : squareOgImage(origin));
	let twitterCard = $derived(imageWidth >= 600 && ogImage ? 'summary_large_image' : 'summary');
	let resolvedImageAlt = $derived(imageAlt?.trim() || resolvedTitle);
	let ogLocale = $derived(seoLang === 'ru' ? 'ru_RU' : 'en_US');
	let ogLocaleAlt = $derived(seoLang === 'ru' ? 'en_US' : 'ru_RU');
	let googleSiteVerification = $derived(
		(import.meta.env.PUBLIC_GOOGLE_SITE_VERIFICATION ?? '').trim()
	);
	let yandexVerification = $derived((import.meta.env.PUBLIC_YANDEX_VERIFICATION ?? '').trim());
</script>

<svelte:head>
	<title>{fullTitle}</title>
	{#if resolvedDescription}
		<meta name="description" content={resolvedDescription} />
	{/if}
	{#if googleSiteVerification}
		<meta name="google-site-verification" content={googleSiteVerification} />
	{/if}
	{#if yandexVerification}
		<meta name="yandex-verification" content={yandexVerification} />
	{/if}
	{#if noindex}
		<meta name="robots" content="noindex, nofollow" />
	{/if}
	{#if origin}
		<link rel="canonical" href={canonicalUrl} />
		{#each alternates as alternate (alternate.lang)}
			<link rel="alternate" hreflang={alternate.lang} href={absoluteUrl(alternate.path, origin)} />
		{/each}
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
		{#if searchThumb}
			<meta property="og:image" content={searchThumb} />
			<meta property="og:image:width" content="1200" />
			<meta property="og:image:height" content="1200" />
			<meta property="og:image:alt" content={SITE_NAME} />
		{/if}
		<meta name="twitter:card" content={twitterCard} />
		<meta name="twitter:title" content={fullTitle} />
		{#if resolvedDescription}
			<meta name="twitter:description" content={resolvedDescription} />
		{/if}
		<meta name="twitter:image" content={ogImage} />
	{/if}
</svelte:head>
