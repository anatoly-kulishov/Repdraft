<script lang="ts">
	import ArticleCard from '$lib/components/ArticleCard.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import { filterArticles } from '$lib/domain/articles';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { ArrowLeft } from '@lucide/svelte';

	let { data } = $props();

	let lang = $derived($resolvedLocale);
	let query = $state('');
	let filtered = $derived(filterArticles(data.articles, query, lang));
	let title = $derived(translate(lang, 'articles.title'));
</script>

<svelte:head>
	<title>{title} · Repdraft</title>
</svelte:head>

<div class="content-page content-page--catalog">
	<ScreenHeader class="lg:hidden" {title} backHref="/exercises" />

	<section class="articles-hub" aria-labelledby="articles-hub-heading">
		<p class="page-lead lg:hidden">{translate(lang, 'articles.lead')}</p>

		<div class="catalog-subroute-header">
			<a class="catalog-zone-crumb-link" href="/exercises">
				<LucideIcon icon={ArrowLeft} size={ICON_SMALL} />
				{translate(lang, 'catalog.hubTitle')}
			</a>
			<header class="page-header page-header--compact catalog-zone-head">
				<h1 id="articles-hub-heading" class="page-title catalog-zone-title">{title}</h1>
				<p class="page-lead">{translate(lang, 'articles.lead')}</p>
			</header>
		</div>

		<div class="articles-hub__search">
			<SearchInput bind:value={query} placeholder={translate(lang, 'articles.search')} />
		</div>

		{#if filtered.length === 0}
			<EmptyState
				title={translate(lang, 'articles.emptyTitle')}
				description={translate(lang, 'articles.emptyDesc')}
			/>
		{:else}
			<div class="articles-hub__grid">
				{#each filtered as article (`${article.slug}:${article.locale}`)}
					<ArticleCard {article} />
				{/each}
			</div>
		{/if}
	</section>
</div>
