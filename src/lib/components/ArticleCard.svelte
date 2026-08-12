<script lang="ts">
	import type { Article } from '$lib/domain/articles';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	let {
		article,
		compact = false
	}: {
		article: Article;
		compact?: boolean;
	} = $props();

	let lang = $derived($resolvedLocale);
	let href = $derived(`/articles/${article.slug}`);
	let tone = $derived(article.coverTone ?? 'purple');
</script>

<a {href} class="article-card" class:article-card--compact={compact} data-tone={tone}>
	<div class="article-card__cover" aria-hidden="true"></div>
	<div class="article-card__body">
		<h2 class="article-card__title">{article.title}</h2>
		<p class="article-card__excerpt">{article.excerpt}</p>
		<span class="article-card__cta">{translate(lang, 'articles.read')}</span>
	</div>
</a>
