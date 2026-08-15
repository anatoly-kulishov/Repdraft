<script lang="ts">
	import ArticleCover from '$lib/components/ArticleCover.svelte';
	import { renderArticleBody } from '$lib/domain/articles';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import SubrouteBack from '$lib/components/SubrouteBack.svelte';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	let { data } = $props();

	let lang = $derived($resolvedLocale);
	let article = $derived(data.article);
	let bodyHtml = $derived(renderArticleBody(article.bodyMd));
	let ctaHref = $derived(article.ctaHref ?? '/exercises');
	let ctaLabel = $derived(
		translate(lang, article.ctaLabelKey ?? 'articles.ctaExercises')
	);
	let tone = $derived(article.coverTone ?? 'purple');
</script>

<svelte:head>
	<title>{article.title} · Repdraft</title>
</svelte:head>

<article class="content-page content-page--narrow article-page pb-mobile-actions lg:pb-0">
	<div class="md:hidden">
		<ScreenHeader title={article.title} backHref="/articles" />
	</div>
	<div class="subroute-desktop-head hidden md:block">
		<SubrouteBack href="/articles" label={translate(lang, 'articles.backHub')} />
	</div>

	<div class="article-page__hero panel" data-tone={tone}>
		<ArticleCover {article} variant="hero" />
		<div class="article-page__hero-text">
			<h1 class="page-title article-page__title hidden md:block">{article.title}</h1>
			<p class="article-page__excerpt">{article.excerpt}</p>
		</div>
	</div>

	<div class="article-body panel prose-article">
		{@html bodyHtml}
	</div>

	<a class="btn-primary btn-block article-page__cta min-h-12" href={ctaHref}>{ctaLabel}</a>
</article>
