<script lang="ts">
	import '$lib/styles/blocks/tools.css';
	import { page } from '$app/stores';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import JsonLd from '$lib/seo/JsonLd.svelte';
	import SeoHead from '$lib/seo/SeoHead.svelte';
	import { buildBreadcrumbJsonLd } from '$lib/seo/jsonLd';
	import { resolveSeoLang } from '$lib/seo/seoLang';
	import { resolveSiteOrigin } from '$lib/seo/site';
	import { TOOLS_HUB_PATH, toolPath, type ToolId } from '$lib/domain/tools';
	import { enPath, ruEnAlternates } from '$lib/seo/alternates';
	import type { AppLocale } from '$lib/i18n/locale';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	/** `/en/tools` mirror passes an explicit locale + canonical path. */
	let {
		localeOverride = null,
		pathOverride = null
	}: { localeOverride?: AppLocale | null; pathOverride?: string | null } = $props();

	let pagePath = $derived(pathOverride ?? TOOLS_HUB_PATH);
	let lang = $derived<AppLocale>(localeOverride ?? $resolvedLocale);
	let seoLang = $derived<AppLocale>(localeOverride ?? resolveSeoLang($page.data.seoLocale, lang));
	let origin = $derived(resolveSiteOrigin($page.url.origin));

	const CARDS: { id: ToolId; titleKey: string; bodyKey: string }[] = [
		{ id: 'one-rep-max', titleKey: 'tools.hub.ormTitle', bodyKey: 'tools.hub.ormBody' },
		{ id: 'calories', titleKey: 'tools.hub.caloriesTitle', bodyKey: 'tools.hub.caloriesBody' },
		{ id: 'bmi', titleKey: 'tools.hub.bmiTitle', bodyKey: 'tools.hub.bmiBody' },
		{
			id: 'heart-rate-zones',
			titleKey: 'tools.hub.hrTitle',
			bodyKey: 'tools.hub.hrBody'
		}
	];

	let jsonLd = $derived([
		buildBreadcrumbJsonLd(origin, [
			{ name: translate(seoLang, 'nav.tabHome'), path: '/' },
			{ name: translate(seoLang, 'tools.title'), path: pagePath }
		])
	]);
</script>

<SeoHead titleKey="tools.title" descriptionKey="seo.toolsDescription" path={pagePath}
	locale={seoLang}
	alternates={ruEnAlternates(TOOLS_HUB_PATH)}
/>
<JsonLd data={jsonLd} />

<div class="content-page tools-page">
	<ScreenHeader title={translate(lang, 'tools.title')} backHref="/" backLabelVisible />

	<p class="tools-lead">{translate(lang, 'tools.lead')}</p>

	<section class="tools-grid" aria-label={translate(lang, 'tools.title')}>
		{#each CARDS as card (card.id)}
			<a class="panel tools-card" href={localeOverride === 'en' ? enPath(toolPath(card.id)) : toolPath(card.id)}>
				<h2 class="tools-card__title">{translate(lang, card.titleKey)}</h2>
				<p class="tools-card__body">{translate(lang, card.bodyKey)}</p>
				<span class="tools-card__arrow">{translate(lang, 'tools.open')} →</span>
			</a>
		{/each}
	</section>

	<p class="tool-note">{translate(lang, 'tools.localNote')}</p>
</div>
