<script lang="ts">
	import ArticleCard from '$lib/components/ArticleCard.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import { filterArticles } from '$lib/domain/articles';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	let { data } = $props();

	let lang = $derived($resolvedLocale);
	let query = $state('');
	let filtered = $derived(filterArticles(data.articles, query, lang));
</script>

<svelte:head>
	<title>{translate(lang, 'articles.title')} — Repdraft</title>
</svelte:head>

<div class="content-page content-page--wide">
	<ScreenHeader title={translate(lang, 'articles.title')} backHref="/exercises" />

	<section class="articles-hub" aria-labelledby="articles-hub-heading">
		<header class="page-header page-header--compact">
			<h1 id="articles-hub-heading" class="page-title">{translate(lang, 'articles.title')}</h1>
			<p class="page-lead">{translate(lang, 'articles.lead')}</p>
		</header>

		<div class="articles-hub__search panel">
			<SearchInput bind:value={query} placeholder={translate(lang, 'articles.search')} />
		</div>

		{#if filtered.length === 0}
			<EmptyState
				title={translate(lang, 'articles.emptyTitle')}
				description={translate(lang, 'articles.emptyDesc')}
			/>
		{:else}
			<div class="articles-hub__grid">
				{#each filtered as article (article.slug)}
					<ArticleCard {article} />
				{/each}
			</div>
		{/if}
	</section>
</div>
