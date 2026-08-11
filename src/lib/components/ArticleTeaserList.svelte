<script lang="ts">
	import ArticleCard from '$lib/components/ArticleCard.svelte';
	import type { Article } from '$lib/domain/articles';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	let {
		articles,
		title = '',
		limit = 3,
		compact = true
	}: {
		articles: Article[];
		title?: string;
		limit?: number;
		compact?: boolean;
	} = $props();

	let lang = $derived($resolvedLocale);
	let shown = $derived(articles.slice(0, limit));
</script>

{#if shown.length > 0}
	<section class="article-teaser" aria-labelledby={title ? 'article-teaser-heading' : undefined}>
		<div class="article-teaser__head">
			{#if title}
				<h2 id="article-teaser-heading" class="section-title">{title}</h2>
			{/if}
			<a class="article-teaser__all" href="/articles">{translate(lang, 'articles.viewAll')}</a>
		</div>
		<div class="article-teaser__list">
			{#each shown as article (article.slug)}
				<ArticleCard {article} {compact} />
			{/each}
		</div>
	</section>
{/if}
