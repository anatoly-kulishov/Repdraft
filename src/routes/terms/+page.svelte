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
		['terms.s7Title', 'terms.s7Body']
	] as const;
</script>

<SeoHead titleKey="terms.title" descriptionKey="seo.termsDescription" path="/terms" />

<div class="content-page content-page--narrow privacy-page">
	<ScreenHeader {title} backHref="/auth" />

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
			<h2 class="section-title">{translate(lang, 'terms.s8Title')}</h2>
			<p>
				{translate(lang, 'terms.s8Body')}
				<a class="privacy-page__media-link" href="/privacy">{translate(lang, 'privacy.link')}</a>.
			</p>
		</section>
	</div>

	<WhatsNewSheet class="privacy-page__version" />
</div>
