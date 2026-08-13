<script lang="ts">
	import CatalogZoneCard from '$lib/components/CatalogZoneCard.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_BUTTON } from '$lib/components/icons/sizes';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import { translate } from '$lib/i18n/messages';
	import { catalogUi } from '$lib/stores/catalogUi';
	import { records, recordsReady } from '$lib/stores/records';
	import { resolvedLocale } from '$lib/stores/locale';
	import { goto } from '$app/navigation';
	import { BookOpen, Bookmark, List, Trophy } from '@lucide/svelte';
	import { onMount } from 'svelte';

	let { data } = $props();

	let lang = $derived($resolvedLocale);
	let searchQuery = $state('');
	let error = $derived(data.indexError);
	let recordCount = $derived($records.length);

	onMount(() => {
		/* Fresh hub visit: drop leftover list facets before search / browse-all. */
		catalogUi.reset();
		void records.refresh();
	});

	function openSearch(query: string) {
		const q = query.trim();
		catalogUi.reset();
		const path = q ? `/catalog/all?q=${encodeURIComponent(q)}` : '/catalog/all';
		void goto(path);
	}

	function onSearchSubmit(event: Event) {
		event.preventDefault();
		openSearch(searchQuery);
	}
</script>

<svelte:head>
	<title>{translate(lang, 'catalog.hubTitle')} — Repdraft</title>
</svelte:head>

<section class="catalog-hub content-page content-page--wide" aria-labelledby="catalog-hub-heading">
	<header class="page-header catalog-hub-intro">
		<h1 id="catalog-hub-heading" class="page-title">{translate(lang, 'catalog.hubTitle')}</h1>
		<p class="page-lead catalog-hub-intro__lead">{translate(lang, 'catalog.hubLead')}</p>
	</header>

	<div class="catalog-hub-toolbar panel">
		<form class="catalog-hub-toolbar__search" onsubmit={onSearchSubmit}>
			<SearchInput bind:value={searchQuery} placeholder={translate(lang, 'catalog.search')} />
		</form>
	</div>

	<nav class="catalog-hub-chips" aria-label={translate(lang, 'catalog.hubNavAria')}>
		<a class="catalog-hub-chip catalog-hub-chip--primary" href="/catalog/all">
			<LucideIcon icon={List} size={ICON_BUTTON} />
			<span>{translate(lang, 'catalog.browseAll')}</span>
		</a>
		<a class="catalog-hub-chip" href="/exercises/saved">
			<LucideIcon icon={Bookmark} size={ICON_BUTTON} />
			<span>{translate(lang, 'bookmarks.title')}</span>
		</a>
		<a class="catalog-hub-chip" href="/articles">
			<LucideIcon icon={BookOpen} size={ICON_BUTTON} />
			<span>{translate(lang, 'articles.title')}</span>
		</a>
		<a class="catalog-hub-chip" href="/records">
			<LucideIcon icon={Trophy} size={ICON_BUTTON} />
			<span>{translate(lang, 'records.title')}</span>
			{#if $recordsReady && recordCount > 0}
				<span class="catalog-hub-nav-count">{recordCount}</span>
			{/if}
		</a>
	</nav>

	{#if error}
		<EmptyState
			title={translate(lang, 'catalog.dataMissing')}
			description={error ? translate(lang, error) : ''}
		/>
	{:else}
		<div class="catalog-hub-grid">
			{#each data.hubZones as bodyPart (bodyPart)}
				<CatalogZoneCard
					{bodyPart}
					count={data.zoneCounts[bodyPart] ?? 0}
					coverImage={data.zoneCovers[bodyPart] ?? null}
				/>
			{/each}
		</div>
	{/if}
</section>
