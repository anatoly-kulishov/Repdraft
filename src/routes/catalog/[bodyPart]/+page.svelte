<script lang="ts">
	import CatalogExerciseList from '$lib/components/CatalogExerciseList.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import { labelBodyPart } from '$lib/domain/labels.ru';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { ArrowLeft } from '@lucide/svelte';

	let { data } = $props();

	let lang = $derived($resolvedLocale);
	let title = $derived(
		data.bodyPart === 'all'
			? translate(lang, 'catalog.allExercises')
			: labelBodyPart(data.bodyPart, lang)
	);
	let presetBodyPart = $derived(data.bodyPart === 'all' ? 'all' : data.bodyPart);
</script>

<svelte:head>
	<title>{title} — Repdraft</title>
</svelte:head>

<div class="content-page content-page--wide">
	<ScreenHeader {title} backHref="/exercises" />

	<section class="catalog-zone-shell">
		<div class="catalog-subroute-header">
			<a class="catalog-zone-crumb-link" href="/exercises">
				<LucideIcon icon={ArrowLeft} size={ICON_SMALL} />
				{translate(lang, 'catalog.hubTitle')}
			</a>
			<div class="page-header page-header--compact catalog-zone-head">
				<h1 class="page-title catalog-zone-title">{title}</h1>
			</div>
		</div>

		{#key `${data.bodyPart}|${data.initialEquipment}|${data.initialTarget}|${data.initialQuery}`}
			<CatalogExerciseList
				bodyParts={data.bodyParts}
				equipment={data.equipment}
				targets={data.targets}
				totalCount={data.totalCount}
				indexError={data.indexError}
				{presetBodyPart}
				initialQuery={data.initialQuery}
				initialEquipment={data.initialEquipment}
				initialTarget={data.initialTarget}
				gridOnDesktop
			/>
		{/key}
	</section>
</div>
