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
		estimateOneRepMax,
		loadTableForOneRepMax,
		parseToolNumber,
		toolPath
	} from '$lib/domain/tools';
	import { enPath, ruEnAlternates } from '$lib/seo/alternates';
	import type { AppLocale } from '$lib/i18n/locale';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	const PATH = toolPath('one-rep-max');

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

	let weightRaw = $state('80');
	let repsRaw = $state('5');

	let weightKg = $derived(
		parseToolNumber(weightRaw, 80, 1, TOOL_LIMITS.liftKgMax)
	);
	let reps = $derived(
		parseToolNumber(repsRaw, 5, TOOL_LIMITS.repsMin, TOOL_LIMITS.repsMax)
	);
	let estimate = $derived(estimateOneRepMax(weightKg, reps));
	let loads = $derived(loadTableForOneRepMax(estimate.average));

	let jsonLd = $derived([
		buildToolJsonLd(origin, {
			path: pagePath,
			title: translate(seoLang, 'tools.orm.title'),
			description: translate(seoLang, 'seo.toolOrmDescription'),
			locale: seoLang
		}),
		buildBreadcrumbJsonLd(origin, [
			{ name: translate(seoLang, 'nav.tabHome'), path: '/' },
			{ name: translate(seoLang, 'tools.title'), path: hubHref },
			{ name: translate(seoLang, 'tools.orm.title'), path: pagePath }
		])
	]);

	const ROWS = [
		{ key: 'tools.orm.epley', pick: (e: { epley: number }) => e.epley },
		{ key: 'tools.orm.brzycki', pick: (e: { brzycki: number }) => e.brzycki },
		{ key: 'tools.orm.lombardi', pick: (e: { lombardi: number }) => e.lombardi }
	] as const;

	function kg(value: number): string {
		return String(Math.round(value * 10) / 10);
	}
</script>

<SeoHead
	titleKey="tools.orm.title"
	descriptionKey="seo.toolOrmDescription"
	path={pagePath}
	locale={seoLang}
	alternates={ruEnAlternates(PATH)}
/>
<JsonLd data={jsonLd} />

<div class="content-page tools-page">
	<ScreenHeader
		title={translate(lang, 'tools.orm.title')}
		backHref={hubHref}
		backLabel={translate(lang, 'tools.title')}
		backLabelVisible
	/>

	<p class="tools-lead">{translate(lang, 'tools.orm.lead')}</p>

	<div class="tools-layout">
		<AppPanel class="tool-panel">
			<label class="tool-field">
				<span class="tool-field__label">{translate(lang, 'tools.orm.weightLabel')}</span>
				<AppInput
					type="number"
					inputmode="decimal"
					min="1"
					max={TOOL_LIMITS.liftKgMax}
					step="0.5"
					value={weightRaw}
					oninput={(event) => (weightRaw = event.currentTarget.value)}
				/>
			</label>

			<label class="tool-field">
				<span class="tool-field__label">{translate(lang, 'tools.orm.repsLabel')}</span>
				<AppInput
					type="number"
					inputmode="numeric"
					min={TOOL_LIMITS.repsMin}
					max={TOOL_LIMITS.repsMax}
					step="1"
					value={repsRaw}
					oninput={(event) => (repsRaw = event.currentTarget.value)}
				/>
			</label>
		</AppPanel>

		<AppPanel class="tool-panel">
			<span class="tool-field__label">{translate(lang, 'tools.orm.estimate')}</span>
			<p class="tool-big">
				<span class="tool-big__value">{kg(estimate.average)}</span>
				<span class="tool-big__unit">{translate(lang, 'tools.unitKg')}</span>
			</p>

			<div>
				{#each ROWS as row (row.key)}
					<div class="tool-row">
						<span>{translate(lang, row.key)}</span>
						<span class="tool-row__value">{kg(row.pick(estimate))} {translate(lang, 'tools.unitKg')}</span>
					</div>
				{/each}
				<div class="tool-row tool-row--total">
					<span>{translate(lang, 'tools.orm.average')}</span>
					<span class="tool-row__value">{kg(estimate.average)} {translate(lang, 'tools.unitKg')}</span>
				</div>
			</div>

			<h2 class="tool-section-title">{translate(lang, 'tools.orm.loadsTitle')}</h2>
			<div>
				{#each loads as row (row.percent)}
					<div class="tool-row">
						<span>{translate(lang, 'tools.orm.percentOfMax', { percent: row.percent })}</span>
						<span class="tool-row__value">
							{kg(row.loadKg)} {translate(lang, 'tools.unitKg')} · {translate(lang, 'tools.orm.approxReps')} {row.approxReps}
						</span>
					</div>
				{/each}
			</div>
		</AppPanel>
	</div>

	<ToolTail
		howTitle={translate(lang, 'tools.orm.howTitle')}
		howPoints={[
			translate(lang, 'tools.orm.how1'),
			translate(lang, 'tools.orm.how2'),
			translate(lang, 'tools.orm.how3')
		]}
		note={translate(lang, 'tools.orm.note')}
		current="one-rep-max"
		enMirror={localeOverride === 'en'}
	/>
</div>
