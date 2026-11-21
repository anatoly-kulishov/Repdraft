<script lang="ts">
	import '$lib/styles/blocks/programs.css';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import JsonLd from '$lib/seo/JsonLd.svelte';
	import SeoHead from '$lib/seo/SeoHead.svelte';
	import { buildBreadcrumbJsonLd } from '$lib/seo/jsonLd';
	import { resolveSeoLang } from '$lib/seo/seoLang';
	import { resolveSiteOrigin } from '$lib/seo/site';
	import { enPath, ruEnAlternates } from '$lib/seo/alternates';
	import type { AppLocale } from '$lib/i18n/locale';
	import {
		PROGRAMS,
		PROGRAMS_HUB_PATH,
		programLead,
		programPath,
		programProgressView,
		programTitle
	} from '$lib/domain/programs';
	import { translate } from '$lib/i18n/messages';
	import { live } from '$lib/stores/live';
	import { programs } from '$lib/stores/programs';
	import { resolvedLocale } from '$lib/stores/locale';

	/** `/en/programs` mirror passes an explicit locale + canonical path. */
	let {
		localeOverride = null,
		pathOverride = null
	}: { localeOverride?: AppLocale | null; pathOverride?: string | null } = $props();

	let pagePath = $derived(pathOverride ?? PROGRAMS_HUB_PATH);
	let lang = $derived<AppLocale>(localeOverride ?? $resolvedLocale);
	let seoLang = $derived<AppLocale>(localeOverride ?? resolveSeoLang($page.data.seoLocale, lang));
	let origin = $derived(resolveSiteOrigin($page.url.origin));

	let runs = $derived($programs);

	let jsonLd = $derived([
		buildBreadcrumbJsonLd(origin, [
			{ name: translate(seoLang, 'nav.tabHome'), path: '/' },
			{ name: translate(seoLang, 'programs.title'), path: pagePath }
		])
	]);

	function progressOf(slug: string) {
		const program = PROGRAMS.find((item) => item.slug === slug);
		return program ? programProgressView(program, runs[slug] ?? null) : null;
	}

	onMount(() => {
		programs.hydrate();
		void (async () => {
			await live.refreshHistory();
			// Local data only: program progress cannot be known during prerender.
			const finished = new Set(
				get(live)
					.history.filter((session) => session.finishedAt && session.planId)
					.map((session) => session.planId as string)
			);
			for (const program of PROGRAMS) programs.syncFinished(program.slug, finished);
		})();
	});
</script>

<SeoHead
	titleKey="programs.title"
	descriptionKey="seo.programsDescription"
	path={pagePath}
	locale={seoLang}
	alternates={ruEnAlternates(PROGRAMS_HUB_PATH)}
/>
<JsonLd data={jsonLd} />

<div class="content-page programs-page">
	<ScreenHeader title={translate(lang, 'programs.title')} backHref="/" backLabelVisible />

	<p class="programs-lead">{translate(lang, 'programs.lead')}</p>

	<section class="programs-grid" aria-label={translate(lang, 'programs.title')}>
		{#each PROGRAMS as program (program.slug)}
			{@const progress = progressOf(program.slug)}
			<a class="panel program-card" href={localeOverride === 'en' ? enPath(programPath(program.slug)) : programPath(program.slug)}>
				<div class="program-tags">
					<span class="program-tag">
						{translate(
							lang,
							program.level === 'novice' ? 'programs.levelNovice' : 'programs.levelIntermediate'
						)}
					</span>
					<span class="program-tag">
						{translate(lang, 'programs.weeks', { n: program.weeks })}
					</span>
				</div>
				<h2 class="program-card__title">{programTitle(program, lang)}</h2>
				<p class="program-card__body">{programLead(program, lang)}</p>
				<p class="program-card__meta">
					{translate(lang, 'programs.sessionsPerWeek', { n: program.sessions.length })}
				</p>
				{#if progress}
					<div class="program-progress">
						<div class="program-progress__row">
							<span>{translate(lang, 'programs.progress', { done: progress.done, total: progress.total })}</span>
							<span>{progress.percent}%</span>
						</div>
						<div
							class="program-progress__bar"
							role="progressbar"
							aria-valuenow={progress.done}
							aria-valuemin={0}
							aria-valuemax={progress.total}
						>
							<div class="program-progress__fill" style="width: {progress.percent}%"></div>
						</div>
					</div>
				{/if}
				<span class="program-card__arrow">{translate(lang, 'programs.open')} →</span>
			</a>
		{/each}
	</section>

	<p class="program-note">{translate(lang, 'programs.hubNote')}</p>
</div>
