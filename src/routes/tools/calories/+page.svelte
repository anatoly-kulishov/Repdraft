<script lang="ts">
	import '$lib/styles/blocks/tools.css';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import AppChip from '$lib/components/AppChip.svelte';
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
		ACTIVITY_FACTOR_IDS,
		CALORIE_GOALS,
		SEXES,
		TOOL_LIMITS,
		TOOLS_HUB_PATH,
		calcBmrMifflin,
		calcMacros,
		calcTdee,
		calorieTarget,
		parseToolNumber,
		toolPath,
		type ActivityFactorId,
		type CalorieGoal,
		type Sex
	} from '$lib/domain/tools';
	import { enPath, ruEnAlternates } from '$lib/seo/alternates';
	import type { AppLocale } from '$lib/i18n/locale';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { athleteProfile } from '$lib/stores/prefs';

	const PATH = toolPath('calories');

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

	let sex = $state<Sex>('male');
	let ageRaw = $state('30');
	let heightRaw = $state('180');
	let weightRaw = $state('80');
	let activity = $state<ActivityFactorId>('moderate');
	let goal = $state<CalorieGoal>('maintain');

	/** The intake profile already knows height/weight - do not ask twice. */
	onMount(() => {
		const profile = $athleteProfile;
		if (profile.weightKg) weightRaw = String(profile.weightKg);
		if (profile.heightCm) heightRaw = String(profile.heightCm);
	});

	let age = $derived(parseToolNumber(ageRaw, 30, TOOL_LIMITS.ageMin, TOOL_LIMITS.ageMax));
	let heightCm = $derived(
		parseToolNumber(heightRaw, 180, TOOL_LIMITS.heightCmMin, TOOL_LIMITS.heightCmMax)
	);
	let weightKg = $derived(
		parseToolNumber(weightRaw, 80, TOOL_LIMITS.weightKgMin, TOOL_LIMITS.weightKgMax)
	);

	let bmr = $derived(calcBmrMifflin({ sex, weightKg, heightCm, age }));
	let tdee = $derived(calcTdee(bmr, activity));
	let target = $derived(calorieTarget(tdee, goal));
	let macros = $derived(calcMacros(target, weightKg));

	const ACTIVITY_KEYS: Record<ActivityFactorId, string> = {
		sedentary: 'tools.cal.activitySedentary',
		light: 'tools.cal.activityLight',
		moderate: 'tools.cal.activityModerate',
		high: 'tools.cal.activityHigh',
		athlete: 'tools.cal.activityAthlete'
	};

	const GOAL_KEYS: Record<CalorieGoal, string> = {
		cut: 'tools.cal.goalCut',
		maintain: 'tools.cal.goalMaintain',
		gain: 'tools.cal.goalGain'
	};

	let jsonLd = $derived([
		buildToolJsonLd(origin, {
			path: pagePath,
			title: translate(seoLang, 'tools.cal.title'),
			description: translate(seoLang, 'seo.toolCaloriesDescription'),
			locale: seoLang
		}),
		buildBreadcrumbJsonLd(origin, [
			{ name: translate(seoLang, 'nav.tabHome'), path: '/' },
			{ name: translate(seoLang, 'tools.title'), path: hubHref },
			{ name: translate(seoLang, 'tools.cal.title'), path: pagePath }
		])
	]);

	function kcal(value: number): string {
		return String(Math.round(value));
	}

	function grams(value: number): string {
		return String(Math.round(value));
	}
</script>

<SeoHead
	titleKey="tools.cal.title"
	descriptionKey="seo.toolCaloriesDescription"
	path={pagePath}
	locale={seoLang}
	alternates={ruEnAlternates(PATH)}
/>
<JsonLd data={jsonLd} />

<div class="content-page tools-page">
	<ScreenHeader
		title={translate(lang, 'tools.cal.title')}
		backHref={hubHref}
		backLabel={translate(lang, 'tools.title')}
		backLabelVisible
	/>

	<p class="tools-lead">{translate(lang, 'tools.cal.lead')}</p>

	<div class="tools-layout">
		<AppPanel class="tool-panel">
			<div class="tool-field">
				<span class="tool-field__label">{translate(lang, 'tools.cal.sexLabel')}</span>
				<div class="tool-chips">
					{#each SEXES as option (option)}
						<AppChip active={sex === option} onclick={() => (sex = option)}>
							{translate(lang, option === 'male' ? 'tools.cal.male' : 'tools.cal.female')}
						</AppChip>
					{/each}
				</div>
			</div>

			<label class="tool-field">
				<span class="tool-field__label">{translate(lang, 'tools.cal.ageLabel')}</span>
				<AppInput
					type="number"
					inputmode="numeric"
					min={TOOL_LIMITS.ageMin}
					max={TOOL_LIMITS.ageMax}
					step="1"
					value={ageRaw}
					oninput={(event) => (ageRaw = event.currentTarget.value)}
				/>
			</label>

			<label class="tool-field">
				<span class="tool-field__label">{translate(lang, 'tools.cal.heightLabel')}</span>
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
				<span class="tool-field__label">{translate(lang, 'tools.cal.weightLabel')}</span>
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

			<div class="tool-field">
				<span class="tool-field__label">{translate(lang, 'tools.cal.activityLabel')}</span>
				<div class="tool-chips">
					{#each ACTIVITY_FACTOR_IDS as option (option)}
						<AppChip active={activity === option} onclick={() => (activity = option)}>
							{translate(lang, ACTIVITY_KEYS[option])}
						</AppChip>
					{/each}
				</div>
			</div>

			<div class="tool-field">
				<span class="tool-field__label">{translate(lang, 'tools.cal.goalLabel')}</span>
				<div class="tool-chips">
					{#each CALORIE_GOALS as option (option)}
						<AppChip active={goal === option} onclick={() => (goal = option)}>
							{translate(lang, GOAL_KEYS[option])}
						</AppChip>
					{/each}
				</div>
			</div>
		</AppPanel>

		<AppPanel class="tool-panel">
			<span class="tool-field__label">{translate(lang, 'tools.cal.target')}</span>
			<p class="tool-big">
				<span class="tool-big__value">{kcal(target)}</span>
				<span class="tool-big__unit">{translate(lang, 'tools.cal.kcalPerDay')}</span>
			</p>

			<div>
				<div class="tool-row">
					<span>{translate(lang, 'tools.cal.bmr')}</span>
					<span class="tool-row__value">
						{kcal(bmr)} {translate(lang, 'tools.cal.kcalPerDay')}
					</span>
				</div>
				<div class="tool-row">
					<span>{translate(lang, 'tools.cal.tdee')}</span>
					<span class="tool-row__value">
						{kcal(tdee)} {translate(lang, 'tools.cal.kcalPerDay')}
					</span>
				</div>
				<div class="tool-row tool-row--total">
					<span>{translate(lang, 'tools.cal.target')}</span>
					<span class="tool-row__value">
						{kcal(target)} {translate(lang, 'tools.cal.kcalPerDay')}
					</span>
				</div>
			</div>

			<h2 class="tool-section-title">{translate(lang, 'tools.cal.macrosTitle')}</h2>
			<div>
				<div class="tool-row">
					<span>{translate(lang, 'tools.cal.protein')}</span>
					<span class="tool-row__value">
						{grams(macros.proteinG)} {translate(lang, 'tools.cal.gPerDay')}
					</span>
				</div>
				<div class="tool-row">
					<span>{translate(lang, 'tools.cal.fat')}</span>
					<span class="tool-row__value">
						{grams(macros.fatG)} {translate(lang, 'tools.cal.gPerDay')}
					</span>
				</div>
				<div class="tool-row">
					<span>{translate(lang, 'tools.cal.carbs')}</span>
					<span class="tool-row__value">
						{grams(macros.carbsG)} {translate(lang, 'tools.cal.gPerDay')}
					</span>
				</div>
			</div>
		</AppPanel>
	</div>

	<ToolTail
		howTitle={translate(lang, 'tools.cal.howTitle')}
		howPoints={[
			translate(lang, 'tools.cal.how1'),
			translate(lang, 'tools.cal.how2'),
			translate(lang, 'tools.cal.how3')
		]}
		note={translate(lang, 'tools.cal.note')}
		current="calories"
		enMirror={localeOverride === 'en'}
	/>
</div>
