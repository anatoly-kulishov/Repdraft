<script lang="ts">
	import ArticleCard from '$lib/components/ArticleCard.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import { filterArticles } from '$lib/domain/articles';
	import { translate } from '$lib/i18n/messages';
	import SeoHead from '$lib/seo/SeoHead.svelte';
	import { resolvedLocale } from '$lib/stores/locale';

	let { data } = $props();

	let lang = $derived($resolvedLocale);
	let query = $state('');
	let filtered = $derived(filterArticles(data.articles, query, lang));
	let gettingStarted = $derived(
		filtered.filter((article) => article.tags.includes('getting-started'))
	);
	let otherArticles = $derived(
		filtered.filter((article) => !article.tags.includes('getting-started'))
	);
	let showGettingStartedSection = $derived(!query.trim() && gettingStarted.length > 0);
	let title = $derived(translate(lang, 'articles.title'));
</script>

<SeoHead titleKey="articles.title" descriptionKey="articles.lead" path="/articles" />

<div class="content-page content-page--catalog articles-hub-page">
	<section class="articles-hub" aria-labelledby="articles-hub-heading">
		<ScreenHeader
			titleId="articles-hub-heading"
			{title}
			backHref="/exercises"
			backLabelVisible
			backLabel={translate(lang, 'catalog.hubTitle')}
		/>

		<p class="page-lead articles-hub__lead">{translate(lang, 'articles.lead')}</p>

		<div class="articles-hub__search">
			<SearchInput bind:value={query} placeholder={translate(lang, 'articles.search')} />
		</div>

		{#if filtered.length === 0}
			<EmptyState
				title={translate(lang, 'articles.emptyTitle')}
				description={translate(lang, 'articles.emptyDesc')}
			/>
		{:else}
			{#if showGettingStartedSection}
				<h2 class="section-title articles-hub__section-title">
					{translate(lang, 'articles.homeTeaserTitle')}
				</h2>
				<div class="panel articles-hub__panel">
					<div class="entity-list">
						{#each gettingStarted as article (`${article.slug}:${article.locale}`)}
							<ArticleCard {article} />
						{/each}
					</div>
				</div>
				{#if otherArticles.length > 0}
					<h2 class="section-title articles-hub__section-title articles-hub__section-title--more">
						{translate(lang, 'articles.teaserTitle')}
					</h2>
					<div class="panel articles-hub__panel">
						<div class="entity-list">
							{#each otherArticles as article (`${article.slug}:${article.locale}`)}
								<ArticleCard {article} />
							{/each}
						</div>
					</div>
				{/if}
			{:else}
				<div class="panel articles-hub__panel">
					<div class="entity-list">
						{#each filtered as article (`${article.slug}:${article.locale}`)}
							<ArticleCard {article} />
						{/each}
					</div>
				</div>
			{/if}
		{/if}
	</section>
</div>
