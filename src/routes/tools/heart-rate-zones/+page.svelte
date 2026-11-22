<script lang="ts">
	import '$lib/styles/blocks/tools.css';
	import { page } from '$app/stores';
	import AppInput from '$lib/components/AppInput.svelte';
	import AppPanel from '$lib/components/AppPanel.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import ToolTail from '$lib/components/tools/ToolTail.svelte';
	import JsonLd from '$lib/seo/JsonLd.svelte';
	import SeoHead from '$lib/seo/SeoHead.svelte';
	import { buildBreadcrumbJsonLd, buildToolJsonLd } from '$lib/seo/jsonLd';
	import { resolveSeoLang } from '$lib/seo/seoLang';
	import { resolveSiteOrigin } from '$lib/seo/site';
	import {
		TOOL_LIMITS,
		TOOLS_HUB_PATH,
		heartRateZones,
		parseToolNumber,
		toolPath
	} from '$lib/domain/tools';
	import { enPath, ruEnAlternates } from '$lib/seo/alternates';
	import type { AppLocale } from '$lib/i18n/locale';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	const PATH = toolPath('heart-rate-zones');

	/** `/en/tools/*` mirrors pass an explicit locale + canonical path. */
	let {
		localeOverride = null,
		pathOverride = null
	}: { localeOverride?: AppLocale | null; pathOverride?: string | null } = $props();

	let pagePath = $derived(pathOverride ?? PATH);
	let hubHref = $derived(localeOverride === 'en' ? enPath(TOOLS_HUB_PATH) : TOOLS_HUB_PATH);
	const ZONE_KEYS = [
		'tools.hr.zone1',
		'tools.hr.zone2',
		'tools.hr.zone3',
		'tools.hr.zone4',
		'tools.hr.zone5'
	] as const;

	let lang = $derived<AppLocale>(localeOverride ?? $resolvedLocale);
	let seoLang = $derived<AppLocale>(localeOverride ?? resolveSeoLang($page.data.seoLocale, lang));
	let origin = $derived(resolveSiteOrigin($page.url.origin));

	/** Same as resting pulse: an empty field with a hint, not a number we invented. */
	let ageRaw = $state('');
	let restingRaw = $state('');

	let age = $derived(parseToolNumber(ageRaw, 30, TOOL_LIMITS.ageMin, TOOL_LIMITS.ageMax));
	/** Empty field = no Karvonen: age-based %HRmax zones are the honest default. */
	let restingHr = $derived.by(() => {
		if (!restingRaw.trim()) return null;
		return parseToolNumber(restingRaw, 60, TOOL_LIMITS.restingHrMin, TOOL_LIMITS.restingHrMax);
	});
	let result = $derived(heartRateZones({ age, restingHr }));

	let jsonLd = $derived([
		buildToolJsonLd(origin, {
			path: pagePath,
			title: translate(seoLang, 'tools.hr.title'),
			description: translate(seoLang, 'seo.toolHrDescription'),
			locale: seoLang
		}),
		buildBreadcrumbJsonLd(origin, [
			{ name: translate(seoLang, 'nav.tabHome'), path: '/' },
			{ name: translate(seoLang, 'tools.title'), path: hubHref },
			{ name: translate(seoLang, 'tools.hr.title'), path: pagePath }
		])
	]);
</script>

<SeoHead titleKey="tools.hr.title" descriptionKey="seo.toolHrDescription" path={pagePath}
	locale={seoLang}
	alternates={ruEnAlternates(PATH)} />
<JsonLd data={jsonLd} />

<div class="content-page tools-page">
	<ScreenHeader
		title={translate(lang, 'tools.hr.title')}
		backHref={hubHref}
		backLabel={translate(lang, 'tools.title')}
		backLabelVisible
	/>

	<p class="tools-lead">{translate(lang, 'tools.hr.lead')}</p>

	<div class="tools-layout">
		<AppPanel class="tool-panel">
			<label class="tool-field">
				<span class="tool-field__label">{translate(lang, 'tools.hr.ageLabel')}</span>
				<AppInput
					type="number"
					inputmode="numeric"
					min={TOOL_LIMITS.ageMin}
					max={TOOL_LIMITS.ageMax}
					step="1"
					placeholder="-"
					value={ageRaw}
					oninput={(event) => (ageRaw = event.currentTarget.value)}
				/>
			</label>

			<label class="tool-field">
				<span class="tool-field__label">{translate(lang, 'tools.hr.restingLabel')}</span>
				<AppInput
					type="number"
					inputmode="numeric"
					min={TOOL_LIMITS.restingHrMin}
					max={TOOL_LIMITS.restingHrMax}
					step="1"
					value={restingRaw}
					oninput={(event) => (restingRaw = event.currentTarget.value)}
				/>
				<p class="tool-field__hint">{translate(lang, 'tools.hr.restingHint')}</p>
			</label>
		</AppPanel>

		<AppPanel class="tool-panel">
			<span class="tool-field__label">{translate(lang, 'tools.hr.maxLabel')}</span>
			<p class="tool-big">
				<span class="tool-big__value">{result.maxHr}</span>
				<span class="tool-big__unit">{translate(lang, 'tools.unitBpm')}</span>
			</p>
			<span class="tool-badge">
				{translate(
					lang,
					result.method === 'karvonen' ? 'tools.hr.methodKarvonen' : 'tools.hr.methodHrmax'
				)}
			</span>

			<div class="tool-zones">
				{#each result.zones as zone (zone.index)}
					<div class="tool-zone tool-zone--{zone.index}">
						<span class="tool-zone__dot" aria-hidden="true"></span>
						<span class="tool-zone__label">
							{translate(lang, ZONE_KEYS[zone.index - 1])}
						</span>
						<span class="tool-zone__bpm">{zone.bpmFrom}–{zone.bpmTo}</span>
					</div>
				{/each}
			</div>
		</AppPanel>
	</div>

	<ToolTail
		howTitle={translate(lang, 'tools.hr.howTitle')}
		howPoints={[
			translate(lang, 'tools.hr.how1'),
			translate(lang, 'tools.hr.how2'),
			translate(lang, 'tools.hr.how3')
		]}
		note={translate(lang, 'tools.hr.note')}
		current="heart-rate-zones"
		enMirror={localeOverride === 'en'}
	/>
</div>
