<script lang="ts">
	import CatalogExerciseList from '$lib/components/CatalogExerciseList.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import SubrouteBack from '$lib/components/SubrouteBack.svelte';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	let { data } = $props();

	let lang = $derived($resolvedLocale);
</script>

<svelte:head>
	<title>{translate(lang, 'builder.pickTitle')} — Repdraft</title>
</svelte:head>

<div class="builder-pick-page content-page content-page--wide">
	<div class="md:hidden">
		<ScreenHeader title={translate(lang, 'builder.pickTitle')} backHref="/builder" />
	</div>

	<div class="page-header mb-4 hidden md:block">
		<div class="subroute-desktop-head">
			<SubrouteBack href="/builder" label={translate(lang, 'builder.createTitle')} />
		</div>
		<h1 class="page-title">{translate(lang, 'builder.pickTitle')}</h1>
		<p class="page-lead">{translate(lang, 'builder.pickLead')}</p>
	</div>

	<CatalogExerciseList
		bodyParts={data.bodyParts}
		equipment={data.equipment}
		targets={data.targets}
		totalCount={data.totalCount}
		indexError={data.indexError}
		presetBodyPart="all"
		listOnMobile={true}
		returnAfterAdd="/builder"
	/>
</div>
