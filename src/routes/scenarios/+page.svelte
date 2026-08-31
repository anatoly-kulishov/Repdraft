<script lang="ts">
	import { renderDocMarkdown } from '$lib/domain/docMarkdown';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import SubrouteBack from '$lib/components/SubrouteBack.svelte';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	let { data } = $props();
	let lang = $derived($resolvedLocale);
	let title = $derived(translate(lang, 'scenarios.title'));
	let bodyHtml = $derived(renderDocMarkdown(data.bodyMd));
</script>

<svelte:head>
	<title>{title} · Repdraft</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="content-page content-page--narrow scenarios-page">
	<div class="lg:hidden">
		<ScreenHeader {title} backHref="/auth" />
	</div>
	<div class="subroute-desktop-head">
		<SubrouteBack href="/auth" label={translate(lang, 'scenarios.back')} />
		<h1 class="page-title">{title}</h1>
	</div>

	<p class="scenarios-page__lead">{translate(lang, 'scenarios.lead')}</p>

	<div class="scenarios-page__body panel prose-article prose-doc">
		{@html bodyHtml}
	</div>
</div>
