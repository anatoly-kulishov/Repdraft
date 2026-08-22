<script lang="ts">
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import SubrouteBack from '$lib/components/SubrouteBack.svelte';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	let lang = $derived($resolvedLocale);
	let title = $derived(translate(lang, 'privacy.title'));

	const sections = [
		['privacy.s1Title', 'privacy.s1Body'],
		['privacy.s2Title', 'privacy.s2Body'],
		['privacy.s3Title', 'privacy.s3Body'],
		['privacy.s4Title', 'privacy.s4Body'],
		['privacy.s9Title', 'privacy.s9Body'],
		['privacy.s5Title', 'privacy.s5Body'],
		['privacy.s6Title', 'privacy.s6Body'],
		['privacy.s7Title', 'privacy.s7Body'],
		['privacy.s8Title', 'privacy.s8Body']
	] as const;

	const checks = [
		'privacy.check1',
		'privacy.check2',
		'privacy.check3',
		'privacy.check4',
		'privacy.check5',
		'privacy.check6'
	] as const;
</script>

<svelte:head>
	<title>{title} · Repdraft</title>
</svelte:head>

<div class="content-page content-page--narrow privacy-page">
	<div class="lg:hidden">
		<ScreenHeader {title} backHref="/auth" />
	</div>
	<div class="subroute-desktop-head">
		<SubrouteBack href="/auth" label={translate(lang, 'privacy.back')} />
		<h1 class="page-title">{title}</h1>
	</div>

	<p class="privacy-page__draft panel-dashed">{translate(lang, 'privacy.draftNote')}</p>
	<p class="privacy-page__updated">{translate(lang, 'privacy.updated')}</p>

	<div class="privacy-page__body panel">
		{#each sections as [headingKey, bodyKey] (headingKey)}
			<section class="privacy-page__section">
				<h2 class="section-title">{translate(lang, headingKey)}</h2>
				<p>{translate(lang, bodyKey)}</p>
			</section>
		{/each}
	</div>

	<section class="privacy-page__checklist panel" aria-labelledby="privacy-checklist-title">
		<h2 id="privacy-checklist-title" class="section-title">
			{translate(lang, 'privacy.checklistTitle')}
		</h2>
		<p class="privacy-page__checklist-lead">{translate(lang, 'privacy.checklistLead')}</p>
		<ul class="privacy-page__checklist-list">
			{#each checks as key (key)}
				<li>{translate(lang, key)}</li>
			{/each}
		</ul>
	</section>
</div>
