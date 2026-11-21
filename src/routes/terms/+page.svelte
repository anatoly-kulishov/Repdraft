<script lang="ts">
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import WhatsNewSheet from '$lib/components/WhatsNewSheet.svelte';
	import { privacyPolicyVars } from '$lib/legal/privacyOperator';
	import { translate } from '$lib/i18n/messages';
	import SeoHead from '$lib/seo/SeoHead.svelte';
	import { resolvedLocale } from '$lib/stores/locale';

	let lang = $derived($resolvedLocale);
	let title = $derived(translate(lang, 'terms.title'));
	let policyVars = $derived(privacyPolicyVars());

	const sections = [
		['terms.s0Title', 'terms.s0Body'],
		['terms.s1Title', 'terms.s1Body'],
		['terms.s2Title', 'terms.s2Body'],
		['terms.s3Title', 'terms.s3Body'],
		['terms.s4Title', 'terms.s4Body'],
		['terms.s5Title', 'terms.s5Body'],
		['terms.s6Title', 'terms.s6Body'],
		['terms.s7Title', 'terms.s7Body'],
		['terms.s8Title', 'terms.s8Body'],
		['terms.s9Title', 'terms.s9Body'],
		['terms.s10Title', 'terms.s10Body']
	] as const;
</script>

<SeoHead titleKey="terms.title" descriptionKey="seo.termsDescription" path="/terms" />

<div class="content-page content-page--narrow privacy-page">
	<ScreenHeader {title} backHref="/" />

	<p class="privacy-page__lead">{translate(lang, 'terms.lead')}</p>
	<p class="privacy-page__updated">{translate(lang, 'terms.updated')}</p>

	<div class="privacy-page__body panel">
		{#each sections as [headingKey, bodyKey] (headingKey)}
			<section class="privacy-page__section">
				<h2 class="section-title">{translate(lang, headingKey)}</h2>
				<p>{translate(lang, bodyKey, policyVars)}</p>
			</section>
		{/each}

		<section class="privacy-page__section">
			<h2 class="section-title">{translate(lang, 'terms.privacyTitle')}</h2>
			<p>
				{translate(lang, 'terms.privacyBody')}
				<a class="privacy-page__media-link" href="/privacy">{translate(lang, 'privacy.link')}</a>.
			</p>
		</section>

		<p class="privacy-page__media-links">
			<a class="privacy-page__media-link" href="/legal/requisites">
				{translate(lang, 'legal.requisitesTitle')}
			</a>
		</p>
	</div>

	<WhatsNewSheet class="privacy-page__version" />
</div>
