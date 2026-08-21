<script lang="ts">
	import CatalogExerciseList from '$lib/components/CatalogExerciseList.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { ArrowLeft } from '@lucide/svelte';

	let { data } = $props();

	let lang = $derived($resolvedLocale);
	let title = $derived(translate(lang, 'bookmarks.title'));
</script>

<svelte:head>
	<title>{title} · Repdraft</title>
</svelte:head>

<div class="content-page content-page--catalog catalog-saved-page">
	<ScreenHeader class="lg:hidden" {title} backHref="/exercises" />

	<div class="catalog-subroute-header">
		<a class="catalog-zone-crumb-link" href="/exercises">
			<LucideIcon icon={ArrowLeft} size={ICON_SMALL} />
			{translate(lang, 'catalog.hubTitle')}
		</a>
		<div class="page-header page-header--compact catalog-zone-head">
			<h1 class="page-title catalog-zone-title">{title}</h1>
			<p class="page-lead">{translate(lang, 'bookmarks.lead')}</p>
			<p class="mt-1 max-w-xl text-sm leading-relaxed text-[var(--color-muted)]">
				{translate(lang, 'bookmarks.localOnlyHint')}
			</p>
		</div>
	</div>

	<CatalogExerciseList
		equipment={data.equipment}
		targets={data.targets}
		totalCount={data.totalCount}
		indexError={data.indexError}
		savedOnly
	/>
</div>
