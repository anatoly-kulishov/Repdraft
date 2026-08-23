<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import ArticleCover from '$lib/components/ArticleCover.svelte';
	import { renderArticleBody } from '$lib/domain/articles';
	import { linkWithFrom, resolveBackFrom } from '$lib/domain/navigation';
	import { withFromParam } from '$lib/domain/catalogLinks';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import SubrouteBack from '$lib/components/SubrouteBack.svelte';
	import { backLabelForHref } from '$lib/i18n/backLabel';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { page } from '$app/stores';

	let { data } = $props();

	let lang = $derived($resolvedLocale);
	let article = $derived(
		data.variants.find((a) => a.locale === lang) ??
			data.variants.find((a) => a.locale === 'ru') ??
			data.variants[0]!
	);
	let articlePath = $derived(`/articles/${article.slug}`);
	let backHref = $derived(resolveBackFrom($page.url.searchParams.get('from'), '/articles'));
	let backLabel = $derived(backLabelForHref(backHref, lang));
	let bodyHtml = $derived(renderArticleBody(article.bodyMd));
	let ctaHref = $derived(withFromParam(article.ctaHref ?? '/exercises', articlePath));
	let ctaLabel = $derived(
		translate(lang, article.ctaLabelKey ?? 'articles.ctaExercises')
	);
	let tone = $derived(article.coverTone ?? 'lime');
</script>

<svelte:head>
	<title>{article.title} · Repdraft</title>
</svelte:head>

<article class="content-page content-page--narrow article-page pb-mobile-actions lg:pb-0">
	<div class="lg:hidden">
		<ScreenHeader title={article.title} {backHref} />
	</div>
	<div class="subroute-desktop-head">
		<SubrouteBack href={backHref} label={backLabel} />
	</div>

	<div class="article-page__hero panel" data-tone={tone}>
		<ArticleCover {article} variant="hero" />
		<div class="article-page__hero-text">
			<h1 class="page-title article-page__title hidden lg:block">{article.title}</h1>
			<p class="article-page__excerpt">{article.excerpt}</p>
		</div>
	</div>

	<div class="article-body panel prose-article">
		{@html bodyHtml}
	</div>

	<AppButton block href={ctaHref} class="article-page__cta">{ctaLabel}</AppButton>
</article>
