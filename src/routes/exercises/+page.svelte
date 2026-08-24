<script lang="ts">
	import CatalogHubChips from '$lib/components/CatalogHubChips.svelte';
	import CatalogCategoryCard from '$lib/components/CatalogCategoryCard.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import { isBuilderReturnPath, labelCatalogZone, withFromParam } from '$lib/domain/catalogLinks';
	import { translate } from '$lib/i18n/messages';
	import { catalogUi } from '$lib/stores/catalogUi';
	import { records } from '$lib/stores/records';
	import { resolvedLocale } from '$lib/stores/locale';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	let { data } = $props();

	let lang = $derived($resolvedLocale);
	let searchQuery = $state('');
	let error = $derived(data.indexError);
	let fromParam = $derived($page.url.searchParams.get('from'));
	let fromBuilder = $derived(isBuilderReturnPath(fromParam));
	let hubTitle = $derived(translate(lang, 'catalog.hubTitle'));
	let headerTitle = $derived(
		fromBuilder ? translate(lang, 'builder.addExercise') : hubTitle
	);

	onMount(() => {
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
</script>

<svelte:head>
	<title>{headerTitle} · Repdraft</title>
</svelte:head>

{#if fromBuilder}
	<div class="lg:hidden">
		<!-- sticky (not fixed): avoids phantom spacer when shell chrome is still visible -->
		<ScreenHeader title={headerTitle} backHref="/builder" />
	</div>
{/if}

<section
	class="catalog-hub content-page content-page--catalog"
	class:catalog-hub--from-builder={fromBuilder}
	aria-labelledby="catalog-hub-heading"
>
	<header class="page-header catalog-hub-intro">
		<h1
			id="catalog-hub-heading"
			class="page-title"
			class:catalog-hub-intro__title--chrome={fromBuilder}
		>
			{hubTitle}
		</h1>
		<p class="page-lead catalog-hub-intro__lead">{translate(lang, 'catalog.hubLead')}</p>
	</header>

	<div class="catalog-hub-toolbar">
		<form class="catalog-hub-toolbar__search" onsubmit={onSearchSubmit}>
			<SearchInput bind:value={searchQuery} placeholder={translate(lang, 'catalog.search')} />
		</form>
		<CatalogHubChips from={fromParam} />
	</div>

	{#if error}
		<EmptyState
			title={translate(lang, 'catalog.dataMissing')}
			description={error ? translate(lang, error) : ''}
		/>
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
