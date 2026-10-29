<script lang="ts">
	import '$lib/styles/blocks/exercises-hub.css';
	import CatalogHubChips from '$lib/components/CatalogHubChips.svelte';
	import CatalogCategoryCard from '$lib/components/CatalogCategoryCard.svelte';
	import CatalogCategoryGridSkeleton from '$lib/components/CatalogCategoryGridSkeleton.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import ListSearchBar from '$lib/components/ListSearchBar.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import Coachmark from '$lib/components/onboarding/Coachmark.svelte';
	import {
		CATALOG_HUB_ZONE_COUNT,
		isBuilderReturnPath,
		labelCatalogZone,
		withFromParam
	} from '$lib/domain/catalogLinks';
	import { loadExerciseIndex, peekExerciseIndex } from '$lib/data/loadExercises';
	import { exerciseName } from '$lib/domain/exerciseName';
	import {
		POPULAR_EXERCISE_IDS,
		frequentExercises
	} from '$lib/domain/exerciseFrequency';
	import type { ExerciseIndexItem } from '$lib/domain/types';
	import { draft } from '$lib/stores/draft';
	import { live } from '$lib/stores/live';
	import { toasts } from '$lib/stores/toasts';
	import { blurActiveElement } from '$lib/dom/blurActiveElement';
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
	import { Plus } from 'phosphor-svelte';

	let { data } = $props();

	let lang = $derived($resolvedLocale);
	let seoLang = $derived(resolveSeoLang($page.data.seoLocale, lang));
	let showExercisesSearchCoachmark = $derived(shouldShowCoachmark($onboarding, 'exercises.search'));
	let showExercisesPickerCoachmark = $derived(shouldShowCoachmark($onboarding, 'exercises.picker'));
	let searchQuery = $state('');
	let error = $derived(data.indexError);
	let fromParam = $derived(readSearchParam($page.url, 'from'));
	let fromBuilder = $derived(isBuilderReturnPath(fromParam));
	/** After search tip: point at Saved chip without stacking. */
	let showExercisesSavedCoachmark = $derived(
		!fromBuilder &&
			!showExercisesSearchCoachmark &&
			shouldShowCoachmark($onboarding, 'exercises.saved')
	);
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

	let indexById = $state<Map<string, ExerciseIndexItem>>(new Map());
	/** "Часто тренируете" (history) or "Популярное в зале" (cold start). */
	let frequentRows = $derived(frequentExercises($live.history, { limit: 10 }));
	let frequentItems = $derived.by(() => {
		const ids =
			frequentRows.length > 0
				? frequentRows.map((row) => row.exerciseId)
				: [...POPULAR_EXERCISE_IDS];
		return ids
			.map((id) => indexById.get(id))
			.filter((item): item is ExerciseIndexItem => Boolean(item));
	});
	let frequentTitle = $derived(
		translate(
			lang,
			frequentRows.length > 0 ? 'exercises.frequentTitle' : 'exercises.popularTitle'
		)
	);

	function addFrequent(exercise: ExerciseIndexItem) {
		const result = draft.addToDraft(exercise.id, {
			name: exercise.name,
			equipment: exercise.equipment
		});
		toasts.show(
			translate(lang, result.added ? 'exercise.added' : 'exercise.already'),
			result.added ? 'success' : 'info',
			2600,
			undefined,
			'draft'
		);
	}

	onMount(() => {
		const peeked = peekExerciseIndex();
		if (peeked) indexById = new Map(peeked.map((item) => [item.id, item]));
		void loadExerciseIndex().then((index) => {
			indexById = new Map(index.map((item) => [item.id, item]));
		});
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

	function dismissExercisesSavedCoachmark() {
		onboarding.dismissCoachmark('exercises.saved');
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
			<p class="page-lead catalog-hub-intro__lead">{translate(lang, 'exercises.hubLead')}</p>
		</header>
	{/if}

	<div class="catalog-hub-toolbar">
		<form class="catalog-hub-toolbar__search" onsubmit={onSearchSubmit}>
			<ListSearchBar
				bind:value={searchQuery}
				placeholder={translate(lang, 'catalog.search')}
			/>
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
		{#if showExercisesSavedCoachmark}
			<Coachmark
				message={translate(lang, 'onboarding.coachExercisesSaved')}
				onDismiss={dismissExercisesSavedCoachmark}
			/>
		{/if}
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

	{#if frequentItems.length > 0}
		<section class="exercise-frequent" aria-labelledby="exercise-frequent-title">
			<h2 id="exercise-frequent-title" class="exercise-frequent__title">{frequentTitle}</h2>
			<div class="exercise-frequent__rail">
				{#each frequentItems as item (item.id)}
					{#if fromBuilder}
						<button
							type="button"
							class="exercise-frequent__chip"
							onclick={() => addFrequent(item)}
						>
							<img src={`/${item.image}`} alt="" loading="lazy" />
							<span>{exerciseName(item, lang)}</span>
							<Plus size={16} />
						</button>
					{:else}
						<a
							class="exercise-frequent__chip"
							href={withFromParam(`/exercise/${item.id}`, fromParam)}
						>
							<img src={`/${item.image}`} alt="" loading="lazy" />
							<span>{exerciseName(item, lang)}</span>
						</a>
					{/if}
				{/each}
			</div>
		</section>
	{/if}
</section>
