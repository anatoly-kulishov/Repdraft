<script lang="ts">
	import CatalogExerciseList from '$lib/components/CatalogExerciseList.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import { translate } from '$lib/i18n/messages';
	import SeoHead from '$lib/seo/SeoHead.svelte';
	import { onboarding } from '$lib/stores/onboarding';
	import { resolvedLocale } from '$lib/stores/locale';
	import { onMount } from 'svelte';

	let { data } = $props();

	let lang = $derived($resolvedLocale);
	let title = $derived(translate(lang, 'bookmarks.title'));

	onMount(() => {
		onboarding.dismissCoachmark('exercises.saved');
	});
</script>

<SeoHead title={title} noindex />

<div class="content-page content-page--catalog catalog-page--list catalog-saved-page records-page">
	<ScreenHeader
		fixed
		{title}
		backHref="/exercises"
		backLabelVisible
		backLabel={translate(lang, 'catalog.hubTitle')}
	/>

	<CatalogExerciseList
		equipment={data.equipment}
		targets={data.targets}
		totalCount={data.totalCount}
		indexError={data.indexError}
		savedOnly
		bookmarksCountPeek={data.bookmarksCountPeek}
	/>
</div>
