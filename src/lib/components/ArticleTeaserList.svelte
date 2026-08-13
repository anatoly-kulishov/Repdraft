<script lang="ts">
	import ArticleCard from '$lib/components/ArticleCard.svelte';
	import type { Article } from '$lib/domain/articles';

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

	let shown = $derived(articles.slice(0, limit));
</script>

{#if shown.length > 0}
	<section class="article-teaser" aria-labelledby={title ? 'article-teaser-heading' : undefined}>
		{#if title}
			<h2 id="article-teaser-heading" class="section-title">{title}</h2>
		{/if}
		<div class="article-teaser__list">
			{#each shown as article (article.slug)}
				<ArticleCard {article} {compact} />
			{/each}
		</div>
	</section>
{/if}
