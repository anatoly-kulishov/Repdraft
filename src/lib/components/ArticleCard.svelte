<script lang="ts">
	import ArticleCover from '$lib/components/ArticleCover.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import type { Article } from '$lib/domain/articles';
	import { linkWithFrom } from '$lib/domain/navigation';
	import { resolvedLocale } from '$lib/stores/locale';
	import { ChevronRight } from '@lucide/svelte';

	let {
		article,
		from = '/articles'
	}: {
		article: Article;
		from?: string;
	} = $props();

	let href = $derived(linkWithFrom(`/articles/${article.slug}`, from));
</script>

<a {href} class="article-card entity-row entity-row--link">
	<ArticleCover {article} />
	<div class="article-card__main entity-row__main">
		<h2 class="article-card__title entity-row__title">{article.title}</h2>
		<p class="article-card__excerpt">{article.excerpt}</p>
	</div>
	<LucideIcon icon={ChevronRight} size={ICON_SMALL} class="entity-row__chevron" />
</a>
