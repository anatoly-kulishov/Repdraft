<script lang="ts">
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import SubrouteBack from '$lib/components/SubrouteBack.svelte';
	import { APP_VERSION_LABEL } from '$lib/appVersion';
	import { GYM_VISUAL_TERMS_URL, GYM_VISUAL_URL } from '$lib/data/attribution';
	import { privacyPolicyVars } from '$lib/legal/privacyOperator';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	let lang = $derived($resolvedLocale);
	let title = $derived(translate(lang, 'privacy.title'));
	let policyVars = $derived(privacyPolicyVars());

	const sections = [
		['privacy.s0Title', 'privacy.s0Body'],
		['privacy.s1Title', 'privacy.s1Body'],
		['privacy.s2Title', 'privacy.s2Body'],
		['privacy.s3Title', 'privacy.s3Body'],
		['privacy.s4Title', 'privacy.s4Body'],
		['privacy.s5Title', 'privacy.s5Body'],
		['privacy.s6Title', 'privacy.s6Body'],
		['privacy.s7Title', 'privacy.s7Body'],
		['privacy.s8Title', 'privacy.s8Body'],
		['privacy.s9Title', 'privacy.s9Body'],
		['privacy.s10Title', 'privacy.s10Body'],
		['privacy.s11Title', 'privacy.s11Body'],
		['privacy.s12Title', 'privacy.s12Body']
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

	<p class="privacy-page__lead">{translate(lang, 'privacy.lead')}</p>
	<p class="privacy-page__updated">{translate(lang, 'privacy.updated')}</p>

	<div class="privacy-page__body panel">
		{#each sections as [headingKey, bodyKey] (headingKey)}
			<section class="privacy-page__section">
				<h2 class="section-title">{translate(lang, headingKey)}</h2>
				<p>{translate(lang, bodyKey, policyVars)}</p>
			</section>
		{/each}

		<section class="privacy-page__section" aria-labelledby="privacy-media-title">
			<h2 id="privacy-media-title" class="section-title">
				{translate(lang, 'privacy.s13Title')}
			</h2>
			<p>{translate(lang, 'privacy.s13Body')}</p>
			<p class="privacy-page__media-links">
				<a class="privacy-page__media-link" href={GYM_VISUAL_URL} target="_blank" rel="noreferrer">
					gymvisual.com
				</a>
				<span class="privacy-page__media-sep" aria-hidden="true">·</span>
				<a
					class="privacy-page__media-link"
					href={GYM_VISUAL_TERMS_URL}
					target="_blank"
					rel="noreferrer"
				>
					{translate(lang, 'privacy.s13TermsLink')}
				</a>
			</p>
		</section>
	</div>

	<p class="privacy-page__version" aria-label={translate(lang, 'attr.versionAria', { version: APP_VERSION_LABEL })}>
		{APP_VERSION_LABEL}
	</p>
</div>
