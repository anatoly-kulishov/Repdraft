<script lang="ts">
	import ArticleCover from '$lib/components/ArticleCover.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import type { Article } from '$lib/domain/articles';
	import {
		armArticleCoverViewTransition,
		armedArticleCoverVtId,
		articleCoverViewTransitionName
	} from '$lib/dom/hierarchyViewTransition';
	import { linkWithFrom } from '$lib/domain/navigation';
	import { ChevronRight } from '@lucide/svelte';

	let {
		article,
		from = '/articles'
	}: {
		article: Article;
		from?: string;
	} = $props();

	let href = $derived(linkWithFrom(`/articles/${article.slug}`, from));
	let coverEl = $state<HTMLElement | null>(null);
	let coverVtName = $derived(
		$armedArticleCoverVtId === article.slug
			? articleCoverViewTransitionName(article.slug)
			: undefined
	);

	function armCoverVt() {
		armArticleCoverViewTransition(article.slug);
		if (coverEl) {
			coverEl.style.viewTransitionName = articleCoverViewTransitionName(article.slug);
		}
	}
</script>

<a {href} class="article-card entity-row entity-row--link" onpointerdown={armCoverVt}>
	<div
		bind:this={coverEl}
		class="article-card__cover-vt"
		style:view-transition-name={coverVtName}
	>
		<ArticleCover {article} />
	</div>
	<div class="article-card__main entity-row__main">
		<h2 class="article-card__title entity-row__title">{article.title}</h2>
		<p class="article-card__excerpt">{article.excerpt}</p>
	</div>
	<LucideIcon icon={ChevronRight} size={ICON_SMALL} class="entity-row__chevron" />
</a>
