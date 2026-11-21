<script lang="ts">
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import WhatsNewSheet from '$lib/components/WhatsNewSheet.svelte';
	import { GYM_VISUAL_TERMS_URL } from '$lib/data/attribution';
	import { legalIdentity } from '$lib/legal/privacyOperator';
	import { translate } from '$lib/i18n/messages';
	import SeoHead from '$lib/seo/SeoHead.svelte';
	import { resolvedLocale } from '$lib/stores/locale';

	let lang = $derived($resolvedLocale);
	let title = $derived(translate(lang, 'legal.requisitesTitle'));
	let identity = $derived(legalIdentity());

	let rows = $derived([
		[translate(lang, 'legal.nameLabel'), identity.name],
		[translate(lang, 'legal.innLabel'), identity.inn],
		[translate(lang, 'legal.ogrnLabel'), identity.ogrn],
		[translate(lang, 'legal.addressLabel'), identity.address],
		[translate(lang, 'legal.emailLabel'), identity.email]
	]);
</script>

<SeoHead
	titleKey="legal.requisitesTitle"
	description={translate(lang, 'legal.requisitesLead')}
	path="/legal/requisites"
/>

<div class="content-page content-page--narrow privacy-page">
	<ScreenHeader {title} backHref="/terms" />

	<p class="privacy-page__lead">{translate(lang, 'legal.requisitesLead')}</p>

	<dl class="privacy-page__body panel requisites">
		{#each rows as [label, value] (label)}
			<div class="requisites__row">
				<dt class="requisites__label">{label}</dt>
				<dd class="requisites__value">{value}</dd>
			</div>
		{/each}
	</dl>

	<p class="privacy-page__lead">{translate(lang, 'legal.requisitesNote')}</p>

	<div class="privacy-page__body panel">
		<section class="privacy-page__section">
			<h2 class="section-title">{translate(lang, 'legal.licensesTitle')}</h2>
			<p>{translate(lang, 'legal.licensesBody')}</p>
			<p class="privacy-page__media-links">
				<span class="privacy-page__media-link">{translate(lang, 'legal.licensesFont')}</span>
				<span class="privacy-page__media-sep" aria-hidden="true">·</span>
				<a
					class="privacy-page__media-link"
					href={GYM_VISUAL_TERMS_URL}
					target="_blank"
					rel="noreferrer"
				>
					{translate(lang, 'legal.licensesMedia')}
				</a>
			</p>
		</section>

		<section class="privacy-page__section">
			<p class="privacy-page__media-links">
				<a class="privacy-page__media-link" href="/terms">{translate(lang, 'legal.termsLink')}</a>
				<span class="privacy-page__media-sep" aria-hidden="true">·</span>
				<a class="privacy-page__media-link" href="/privacy">{translate(lang, 'legal.privacyLink')}</a>
			</p>
		</section>
	</div>

	<WhatsNewSheet class="privacy-page__version" />
</div>

<style>
	.requisites {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		margin-bottom: 1rem;
	}

	.requisites__row {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.requisites__label {
		margin: 0;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		color: var(--color-muted);
	}

	.requisites__value {
		margin: 0;
		font-size: 0.9375rem;
		line-height: 1.4;
		color: var(--color-text);
		overflow-wrap: anywhere;
	}
</style>
