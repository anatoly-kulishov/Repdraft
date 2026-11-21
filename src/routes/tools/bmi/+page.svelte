<script lang="ts">
	import '$lib/styles/blocks/tools.css';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
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
		bmiCategory,
		calcBmi,
		healthyWeightRange,
		parseToolNumber,
		toolPath,
		type BmiCategory
	} from '$lib/domain/tools';
	import { enPath, ruEnAlternates } from '$lib/seo/alternates';
	import type { AppLocale } from '$lib/i18n/locale';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { athleteProfile } from '$lib/stores/prefs';

	const PATH = toolPath('bmi');

	/** `/en/tools/*` mirrors pass an explicit locale + canonical path. */
	let {
		localeOverride = null,
		pathOverride = null
	}: { localeOverride?: AppLocale | null; pathOverride?: string | null } = $props();

	let pagePath = $derived(pathOverride ?? PATH);
	let hubHref = $derived(localeOverride === 'en' ? enPath(TOOLS_HUB_PATH) : TOOLS_HUB_PATH);

	let lang = $derived<AppLocale>(localeOverride ?? $resolvedLocale);
	let seoLang = $derived<AppLocale>(localeOverride ?? resolveSeoLang($page.data.seoLocale, lang));
	let origin = $derived(resolveSiteOrigin($page.url.origin));

	let heightRaw = $state('180');
	let weightRaw = $state('80');

	onMount(() => {
		const profile = $athleteProfile;
		if (profile.weightKg) weightRaw = String(profile.weightKg);
		if (profile.heightCm) heightRaw = String(profile.heightCm);
	});

	let heightCm = $derived(
		parseToolNumber(heightRaw, 180, TOOL_LIMITS.heightCmMin, TOOL_LIMITS.heightCmMax)
	);
	let weightKg = $derived(
		parseToolNumber(weightRaw, 80, TOOL_LIMITS.weightKgMin, TOOL_LIMITS.weightKgMax)
	);
	let bmi = $derived(calcBmi(weightKg, heightCm));
	let category = $derived(bmiCategory(bmi));
	let healthy = $derived(healthyWeightRange(heightCm));

	const CATEGORY_KEYS: Record<BmiCategory, string> = {
		under: 'tools.bmi.catUnder',
		normal: 'tools.bmi.catNormal',
		over: 'tools.bmi.catOver',
		obese: 'tools.bmi.catObese'
	};

	let jsonLd = $derived([
		buildToolJsonLd(origin, {
			path: pagePath,
			title: translate(seoLang, 'tools.bmi.title'),
			description: translate(seoLang, 'seo.toolBmiDescription'),
			locale: seoLang
		}),
		buildBreadcrumbJsonLd(origin, [
			{ name: translate(seoLang, 'nav.tabHome'), path: '/' },
			{ name: translate(seoLang, 'tools.title'), path: hubHref },
			{ name: translate(seoLang, 'tools.bmi.title'), path: pagePath }
		])
	]);

	function oneDecimal(value: number): string {
		return (Math.round(value * 10) / 10).toFixed(1);
	}

	function wholeKg(value: number): string {
		return String(Math.round(value));
	}
</script>

<SeoHead titleKey="tools.bmi.title" descriptionKey="seo.toolBmiDescription" path={pagePath}
	locale={seoLang}
	alternates={ruEnAlternates(PATH)} />
<JsonLd data={jsonLd} />

<div class="content-page tools-page">
	<ScreenHeader
		title={translate(lang, 'tools.bmi.title')}
		backHref={hubHref}
		backLabel={translate(lang, 'tools.title')}
		backLabelVisible
	/>

	<p class="tools-lead">{translate(lang, 'tools.bmi.lead')}</p>

	<div class="tools-layout">
		<AppPanel class="tool-panel">
			<label class="tool-field">
				<span class="tool-field__label">{translate(lang, 'tools.bmi.heightLabel')}</span>
				<AppInput
					type="number"
					inputmode="numeric"
					min={TOOL_LIMITS.heightCmMin}
					max={TOOL_LIMITS.heightCmMax}
					step="1"
					value={heightRaw}
					oninput={(event) => (heightRaw = event.currentTarget.value)}
				/>
			</label>

			<label class="tool-field">
				<span class="tool-field__label">{translate(lang, 'tools.bmi.weightLabel')}</span>
				<AppInput
					type="number"
					inputmode="decimal"
					min={TOOL_LIMITS.weightKgMin}
					max={TOOL_LIMITS.weightKgMax}
					step="0.5"
					value={weightRaw}
					oninput={(event) => (weightRaw = event.currentTarget.value)}
				/>
			</label>
		</AppPanel>

		<AppPanel class="tool-panel">
			<span class="tool-field__label">{translate(lang, 'tools.bmi.value')}</span>
			<p class="tool-big">
				<span class="tool-big__value">{oneDecimal(bmi)}</span>
			</p>
			<span class="tool-badge">{translate(lang, CATEGORY_KEYS[category])}</span>

			<div>
				<div class="tool-row">
					<span>{translate(lang, 'tools.bmi.rangeLabel')}</span>
					<span class="tool-row__value">
						{translate(lang, 'tools.bmi.rangeValue', {
							min: wholeKg(healthy.minKg),
							max: wholeKg(healthy.maxKg)
						})}
					</span>
				</div>
			</div>
		</AppPanel>
	</div>

	<ToolTail
		howTitle={translate(lang, 'tools.bmi.howTitle')}
		howPoints={[
			translate(lang, 'tools.bmi.how1'),
			translate(lang, 'tools.bmi.how2'),
			translate(lang, 'tools.bmi.how3')
		]}
		note={translate(lang, 'tools.bmi.note')}
		current="bmi"
		enMirror={localeOverride === 'en'}
	/>
</div>
