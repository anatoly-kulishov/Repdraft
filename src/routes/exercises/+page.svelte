<script lang="ts">
	import CatalogHubChips from '$lib/components/CatalogHubChips.svelte';
	import CatalogCategoryCard from '$lib/components/CatalogCategoryCard.svelte';
	import CatalogCategoryGridSkeleton from '$lib/components/CatalogCategoryGridSkeleton.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import {
		CATALOG_HUB_ZONE_COUNT,
		isBuilderReturnPath,
		labelCatalogZone,
		withFromParam
	} from '$lib/domain/catalogLinks';
	import { loadExerciseIndex } from '$lib/data/loadExercises';
	import { blurActiveElement } from '$lib/dom/blurActiveElement';
	import Coachmark from '$lib/components/onboarding/Coachmark.svelte';
	import { translate } from '$lib/i18n/messages';
	import SeoHead from '$lib/seo/SeoHead.svelte';
	import { resolveSeoLang } from '$lib/seo/seoLang';
	import { catalogUi } from '$lib/stores/catalogUi';
	import { onboarding } from '$lib/stores/onboarding';
	import { shouldShowCoachmark } from '$lib/domain/onboarding';
	import { records } from '$lib/stores/records';
	import { resolvedLocale } from '$lib/stores/locale';
	import { readSearchParam } from '$lib/navigation/urlSearchParams';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	let { data } = $props();

	let lang = $derived($resolvedLocale);
	let seoLang = $derived(resolveSeoLang($page.data.seoLocale, lang));
	let showExercisesSearchCoachmark = $derived(shouldShowCoachmark($onboarding, 'exercises.search'));
	let showExercisesPickerCoachmark = $derived(shouldShowCoachmark($onboarding, 'exercises.picker'));
	let searchQuery = $state('');
	let error = $derived(data.indexError);
	let fromParam = $derived(readSearchParam($page.url, 'from'));
	let fromBuilder = $derived(isBuilderReturnPath(fromParam));
	let hubTitle = $derived(translate(lang, 'catalog.hubTitle'));
	let headerTitle = $derived(
		fromBuilder ? translate(lang, 'builder.addExercise') : hubTitle
	);
	let seoHeaderTitle = $derived(
		fromBuilder ? translate(seoLang, 'builder.addExercise') : translate(seoLang, 'catalog.hubTitle')
	);
	/** Dev/QA: ?skeleton=1 — preview category grid placeholders. */
	let forceSkeleton = $derived(readSearchParam($page.url, 'skeleton') === '1');
	let showCategorySkeleton = $derived(forceSkeleton);

	onMount(() => {
		void loadExerciseIndex();
		/* Fresh hub visit: drop leftover list facets before search / browse-all. */
		catalogUi.reset();
		void records.refresh();
	});

	function openSearch(query: string) {
		const q = query.trim();
		catalogUi.reset();
		const path = q ? `/catalog/all?q=${encodeURIComponent(q)}` : '/catalog/all';
		void goto(withFromParam(path, fromParam));
	}

	function onSearchSubmit(event: Event) {
		event.preventDefault();
		openSearch(searchQuery);
	}

	function dismissExercisesPickerCoachmark() {
		onboarding.dismissCoachmark('exercises.picker');
		blurActiveElement();
	}

	function dismissExercisesSearchCoachmark() {
		onboarding.dismissCoachmark('exercises.search');
		blurActiveElement();
	}
</script>

<SeoHead title={seoHeaderTitle} descriptionKey="seo.exercisesDescription" path="/exercises" />

<section
	class="catalog-hub content-page content-page--catalog"
	class:catalog-hub--from-builder={fromBuilder}
	aria-label={fromBuilder ? headerTitle : undefined}
	aria-labelledby={fromBuilder ? undefined : 'catalog-hub-heading'}
>
	{#if fromBuilder}
		<ScreenHeader
			class="catalog-pick-header"
			title={headerTitle}
			backHref="/builder"
			backLabelVisible
			backLabel={translate(lang, 'builder.title')}
		/>
	{:else}
		<header class="page-header catalog-hub-intro">
			<h1 id="catalog-hub-heading" class="page-title">{hubTitle}</h1>
			<p class="page-lead catalog-hub-intro__lead">{translate(lang, 'catalog.hubLead')}</p>
		</header>
	{/if}

	<div class="catalog-hub-toolbar">
		<form class="catalog-hub-toolbar__search" onsubmit={onSearchSubmit}>
			<SearchInput bind:value={searchQuery} placeholder={translate(lang, 'catalog.search')} />
		</form>
		{#if fromBuilder && showExercisesPickerCoachmark}
			<Coachmark
				message={translate(lang, 'onboarding.coachPickerReturn')}
				onDismiss={dismissExercisesPickerCoachmark}
			/>
		{:else if !fromBuilder && showExercisesSearchCoachmark}
			<Coachmark
				message={translate(lang, 'onboarding.coachExercisesSearch')}
				onDismiss={dismissExercisesSearchCoachmark}
			/>
		{/if}
		<CatalogHubChips from={fromParam} pickMode={fromBuilder} />
	</div>

	{#if error}
		<EmptyState
			title={translate(lang, 'catalog.dataMissing')}
			description={error ? translate(lang, error) : ''}
		/>
	{:else if showCategorySkeleton}
		<CatalogCategoryGridSkeleton label={translate(lang, 'common.loading')} rows={CATALOG_HUB_ZONE_COUNT} />
	{:else}
		<div class="catalog-hub-grid">
			{#each data.hubZones as bodyPart, index (bodyPart)}
				<CatalogCategoryCard
					label={labelCatalogZone(bodyPart, lang)}
					href={withFromParam(`/catalog/${encodeURIComponent(bodyPart)}`, fromParam)}
					count={data.zoneCounts[bodyPart] ?? 0}
					coverImage={data.zoneCovers[bodyPart] ?? null}
					priority={index === 0}
				/>
			{/each}
		</div>
	{/if}
</section>
