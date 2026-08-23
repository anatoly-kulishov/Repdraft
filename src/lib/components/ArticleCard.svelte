<script lang="ts">
	import ArticleCover from '$lib/components/ArticleCover.svelte';
	import type { Article } from '$lib/domain/articles';
	import { linkWithFrom } from '$lib/domain/navigation';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	let {
		article,
		compact = false,
		from = '/articles'
	}: {
		article: Article;
		compact?: boolean;
		from?: string;
	} = $props();

	let lang = $derived($resolvedLocale);
	let href = $derived(linkWithFrom(`/articles/${article.slug}`, from));
	let tone = $derived(article.coverTone ?? 'lime');
</script>

<a {href} class="article-card" class:article-card--compact={compact} data-tone={tone}>
	<ArticleCover {article} {compact} />
	<div class="article-card__body">
		<h2 class="article-card__title">{article.title}</h2>
		<p class="article-card__excerpt">{article.excerpt}</p>
		<span class="article-card__cta">{translate(lang, 'articles.read')}</span>
	</div>
</a>
